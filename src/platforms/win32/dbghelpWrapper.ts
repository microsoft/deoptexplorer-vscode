// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable, DisposableStack } from "@esfx/disposable";
import { Address } from "#core/address.js";
import { kNullAddress } from "#v8/constants.js";
import { FuncInfo } from "#v8/tools/cppEntriesProvider.js";
import * as fs from "fs";
import * as path from "path";
import * as ref from "ref-napi";
import { CancellationError, CancellationToken, Progress, Uri } from "vscode";
import * as dbghelp from "./api/dbghelp";
import * as kernel32 from "./api/kernel32";
import { PSTR, sizeof } from "./api/win32";

// Whether to download symbols from the Microsoft public symbol store, but this can be very slow...
const USE_MS_PUBLIC_SYMBOL_STORE = false;

export interface LoadSymbolsOptions {
    progress?: Progress<string>;
    token?: CancellationToken;
    globalStorageUri?: Uri;
}

export class DbghelpWrapper {
    #dbghelp: dbghelp.Dbghelp;
    #symbolNameBuffer: Buffer | undefined;

    constructor(extensionUri: Uri) {
        this.#dbghelp = new dbghelp.Dbghelp(extensionUri);
    }

    loadSymbols(libName: string, libStart: Address, libEnd: Address, options: LoadSymbolsOptions = {}) {
        const { progress, token, globalStorageUri } = options;
        for (const { using, fail } of Disposable.scope()) try {
            const deferrals = using(new DisposableStack());
            const hProcess = this.#dbghelp.createSimpleHandle();

            // Initialize dbghelp
            const fInitialized = this.#dbghelp.SymInitialize(hProcess);
            if (!fInitialized) {
                kernel32.Win32Error.throwIfNotSuccess();
            }
            else {
                // Ensure we cleanup dbghelp
                deferrals.use(() => { if (!this.#dbghelp.SymCleanup(hProcess)) throw new kernel32.Win32Error(); });
            }

            let prevOptions = this.#dbghelp.SymGetOptions();
            let options = prevOptions & ~dbghelp.SYMOPT_UNDNAME;

            // TODO: Should I specify SYMOPT_SECURE depending on whether the workspace is trusted? If I specify\
            // SYMOPT_SECURE, it cannot be unset later...
            options = options
                | dbghelp.SYMOPT_INCLUDE_32BIT_MODULES
                | dbghelp.SYMOPT_ALLOW_ABSOLUTE_SYMBOLS
                | dbghelp.SYMOPT_AUTO_PUBLICS
                | dbghelp.SYMOPT_DEFERRED_LOADS
                // | dbghelp.SYMOPT_NO_IMAGE_SEARCH
                | dbghelp.SYMOPT_FAIL_CRITICAL_ERRORS
                | dbghelp.SYMOPT_LOAD_LINES // TODO: Make this configurable?
                | dbghelp.SYMOPT_NO_UNQUALIFIED_LOADS // Prevents symbols from being loaded when the caller
                // examines symbols across multiple modules. Examine only
                // the module whose symbols have already been loaded.
                | dbghelp.SYMOPT_FAVOR_COMPRESSED
                | dbghelp.SYMOPT_EXACT_SYMBOLS
                | dbghelp.SYMOPT_UNDNAME
                ;

            if (progress) {
                options |= dbghelp.SYMOPT_DEBUG;
            }

            this.#dbghelp.SymSetOptions(options >>> 0);

            if (!fInitialized) {
                // ensure we restore previous options
                deferrals.use(() => { this.#dbghelp.SymSetOptions(prevOptions); });
            }

            // NOTE: This section would allow us to download symbols from the Microsoft public symbol store, but
            // this can be very slow...
            if (USE_MS_PUBLIC_SYMBOL_STORE && globalStorageUri) {
                const pSearchPath = Buffer.alloc(260) as PSTR;
                if (!this.#dbghelp.SymGetSearchPath(hProcess, pSearchPath, 260)) {
                    throw new kernel32.Win32Error();
                }

                const searchPath = pSearchPath.readCString();
                if (!searchPath.includes("https://msdl.microsoft.com/download/symbols")) {
                    const searchPaths = searchPath.length ? searchPath.split(";") : [];
                    const globalStoragePath = globalStorageUri.fsPath;
                    const symbolStoragePath = path.join(globalStoragePath, "symbols");
                    try { fs.mkdirSync(symbolStoragePath, { recursive: true }); } catch { }
                    searchPaths.push(`srv*${symbolStoragePath}*https://msdl.microsoft.com/download/symbols`);
                    if (!this.#dbghelp.SymSetSearchPath(hProcess, searchPaths.join(";"))) {
                        throw new kernel32.Win32Error();
                    }
                    deferrals.use(() => { if (!this.#dbghelp.SymSetSearchPath(hProcess, searchPath)) throw new kernel32.Win32Error(); });
                }
            }

            if (progress) {
                if (!this.#dbghelp.SymRegisterCallback64(hProcess, (_hProcess, ActionCode, CallbackData, _UserContext) => {
                    if (token?.isCancellationRequested) throw new CancellationError();
                    switch (ActionCode) {
                        case dbghelp.CBA_DEBUG_INFO:
                            console.log(ref.readCString(CallbackData));
                            return true;
                        default:
                            return false;
                    }
                }, ref.NULL as any as ref.Pointer<null>)) {
                    throw new kernel32.Win32Error();
                }
            }

            // load the library
            const base = this.#dbghelp.SymLoadModuleEx(
                hProcess,
                ref.NULL as any as ref.Pointer<null>,
                libName,
                null,
                libStart,
                Number(libEnd - libStart),
                ref.NULL as any as ref.Pointer<null>,
                0
            );

            if (base === kNullAddress) {
                kernel32.Win32Error.throwIfNotSuccess();
            }
            else {
                // ensure we unload the module
                deferrals.use(() => { if (!this.#dbghelp.SymUnloadModule64(hProcess, base)) throw new kernel32.Win32Error(); });
            }

            const moduleInfo = dbghelp.IMAGEHLP_MODULE64({ SizeOfStruct: sizeof(dbghelp.IMAGEHLP_MODULE64) });
            if (!this.#dbghelp.SymGetModuleInfo64(hProcess, base, moduleInfo.ref())) {
                kernel32.Win32Error.throwIfNotSuccess();
            }

            const symbols: FuncInfo[] = [];
            if (!this.#dbghelp.SymEnumSymbols(
                hProcess,
                base,
                "*",
                (pSymbol) => {
                    const symbol = pSymbol.deref();
                    const name = symbol.Name.buffer.readCString();
                    const rva = symbol.Address - symbol.ModBase;
                    const start = libStart + rva;
                    const size = symbol.Size ? symbol.Size : undefined;

                    symbols.push({ name, start, size });
                    return true;
                }, ref.NULL as any as ref.Pointer<null>
            )) {
                throw new kernel32.Win32Error();
            }
            return symbols;
        } catch (e) { fail(e); }
        throw new Error("Unreachable");
    }

    private undecorateSymbolName(name: string, flags: number) {
        this.#symbolNameBuffer ??= Buffer.alloc(4096);
        this.#symbolNameBuffer.type ??= ref.types.byte;
        const bytesWritten = this.#dbghelp.UnDecorateSymbolName(
            name,
            this.#symbolNameBuffer as ref.Pointer<number>,
            this.#symbolNameBuffer.byteLength,
            flags);
        if (bytesWritten > 0) {
            return this.#symbolNameBuffer.toString("utf8", 0, +bytesWritten);
        }
    }

    unmangleName(name: string) {
        // Empty or non-mangled name.
        if (name.length < 1) {
            return name;
        }

        const flags =
            dbghelp.UNDNAME_NO_LEADING_UNDERSCORES |
            dbghelp.UNDNAME_NO_MS_KEYWORDS |
            dbghelp.UNDNAME_NO_FUNCTION_RETURNS |
            dbghelp.UNDNAME_NO_ALLOCATION_MODEL |
            dbghelp.UNDNAME_NO_ALLOCATION_LANGUAGE |
            dbghelp.UNDNAME_NO_MS_THISTYPE |
            dbghelp.UNDNAME_NO_CV_THISTYPE |
            dbghelp.UNDNAME_NO_ACCESS_SPECIFIERS |
            dbghelp.UNDNAME_NO_THROW_SIGNATURES |
            dbghelp.UNDNAME_NO_MEMBER_TYPE |
            dbghelp.UNDNAME_NO_RETURN_UDT_MODEL |
            dbghelp.UNDNAME_32_BIT_DECODE |
            dbghelp.UNDNAME_NAME_ONLY |
            dbghelp.UNDNAME_NO_SPECIAL_SYMS |
            dbghelp.UNDNAME_NO_TYPE_PREFIX |
            dbghelp.UNDNAME_NO_PTR64_EXPANSION;
        return this.undecorateSymbolName(name, flags);
    }
}
