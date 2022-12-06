// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable, DisposableStack } from "@esfx/disposable";
import * as cp from "child_process";
import { randomInt } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as ref from "ref-napi";
import * as semver from "semver";
import { CancellationError, CancellationToken, Progress, Uri, workspace } from "vscode";
import { output } from "../outputChannel";
import { FuncInfo, WindowsCppEntriesProvider as V8WindowsCppEntriesProvider } from "../../third-party-derived/v8/tools/cppEntriesProvider";
import * as dbghelp from "../utils/dbghelp";
import { tryReaddirSync } from "../../core/fs";
import * as kernel32 from "../utils/kernel32";
import { PSTR, sizeof } from "../utils/win32";
import * as winnt from "../utils/winnt";
import { Address, parseAddress, toAddress } from "../../core/address";
import { kNullAddress } from "../../third-party-derived/v8/constants";

// Whether to download symbols from the Microsoft public symbol store, but this can be very slow...
const USE_MS_PUBLIC_SYMBOL_STORE = false;

export interface WindowsCppEntriesProviderOptions {
    targetRootFS?: string;
    removeTemplates?: boolean;
    globalStorageUri?: Uri;
    dumpbinExe?: string;
    useDbghelp?: boolean;
    unmangleNames?: boolean;
}

// NOTE: See https://bugs.chromium.org/p/v8/issues/detail?id=11840 for issues with the
//       WindowsCppEntriesProvider when working with native libraries compiled with ASLR.
export class WindowsCppEntriesProvider extends V8WindowsCppEntriesProvider {
    private removeTemplates?: boolean;
    private _symbols: string | FuncInfo[] = "";
    // private aslr = false;
    private libStart = kNullAddress;
    // private libEnd = kNullAddress;
    private symbolsFormat: "map" | "dumpbin-map" | undefined;
    private dumpbinPath: string | null | undefined;
    private imageBase = toAddress(0);
    private imageBaseChecked = false;
    private symbolNameBuffer: Buffer | undefined;
    private moduleType?: string;
    private globalStorageUri?: Uri;
    private useDbghelp?: boolean;

    constructor({ targetRootFS, removeTemplates, globalStorageUri, useDbghelp, dumpbinExe }: WindowsCppEntriesProviderOptions = {}) {
        super({ targetRootFS });
        this.removeTemplates = removeTemplates;
        this.globalStorageUri = globalStorageUri;
        this.dumpbinPath = dumpbinExe;
        this.useDbghelp = useDbghelp;
    }

    // Address         Publics by Value                         Rva+Base     Lib:Object
    //
    // 0000:00000000   ___ImageBase                             10000000     <linker-defined>
    //                                                          ^^^^^^^^
    //                                                          <address>
    static readonly IMAGE_BASE_RE = /^0000:00000000\s+___ImageBase\s+(?<address>[0-9a-fA-F]{8}[0-9a-fA-F]{8}?).*$/;

    // Address         Publics by Value                         Rva+Base     Lib:Object
    //
    // 0000:00000000   ___ImageBase                             10000000     <linker-defined>
    // 0001:000003b8   ??_C@_15GANGMFKL@?$AA?$CF?$AAs?$AA?$AA@  100013b8     foo.obj
    //                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^  ^^^^^^^^
    //                 <name>                                   <address>
    static readonly FUNC_RE = /^0001:[0-9a-fA-F]{8}\s+(?<name>[_?@$0-9a-zA-Z]+)\s+(?<address>[0-9a-fA-F]{8}[0-9a-fA-F]{8}?).*$/;

    // Address       RVA               Size
    // ------------- -------- -------- ----------
    static readonly DUMPBIN_MAP_RE = /^Address\s+RVA\s+Size$/;

    // Address       RVA               Size
    // ------------- -------- -------- ----------
    // ...
    // 0001:000774E0 000784E0 60503020          4  ?GetColumnNumber@Location@debug@v8@@QEBAHXZ (public: int __cdecl v8::debug::Location::GetColumnNumber(void)const )
    //               ^^^^^^^^                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //               <rva>                         <name>
    static readonly DUMPBIN_MAP_FUNC_RE = /^(?<section>\d{4}):(?<address>[0-9a-fA-F]{8})\s+(?<rva>[0-9a-fA-F]{8})\s+[0-9a-fA-F]{8}\s+(?<size>[0-9]+)\s+(?<name>[_?@$0-9a-zA-Z]+)/;

    // Examples:
    //  ?LookupInDescriptor@JSObject@internal@v8@@...
    //  ??$Add@VIsolate@internal@v8@@
    //  ??0AbstractBytecodeArray@interpreter@internal@v8@@
    //  ??0?$BaseNameDictionary@VGlobalDictionary@internal@v8@@
    //  ??1?$ParserBase@VParser@internal@v8@@
    //  ??A?$vector@PEAVMoveOperands@compiler@internal@v8@@
    //  ??AInputs@Node@compiler@internal@v8@@
    //  ??DTimeDelta@base@v8@@
    //  ??EBytecodeArrayRandomIterator@interpreter@internal@v8@@
    //  ??FBytecodeArrayRandomIterator@interpreter@internal@v8@@
    //  ??G?$TimeBase@VThreadTicks@base@v8@@
    //  ??GTimeDelta@base@v8@@
    //  ??ZTimeDelta@base@v8@@
    //  ??_0TimeDelta@base@v8@@
    //  ??_7?$basic_ios@DU?$char_traits@D@std@@
    // Leaves us with:
    //  ?
    //  ??[0-9A-Z]
    //  ??_[0-9A-Z]
    //  ??$
    //  ??[0-9A-Z]?$
    //  ??_[0-9A-Z]?$
    // Or:
    //  `\?`            - prefix (required)
    //  `\?_?[0-9A-Z]`  - hint (optional)
    //  `\?\$`          - suffix (optional)
    static readonly SYMBOL_PREFIX_RE = /^\?(?:\?_?[0-9A-Z]|_)?(?:\?\$)?(?=[A-Za-z])/;

    // This is almost a constant on 32-bit Windows.
    static readonly EXE_IMAGE_BASE_32 = toAddress(0x000400000);
    static readonly EXE_IMAGE_BASE_64 = toAddress(0x140000000);
    static readonly DLL_IMAGE_BASE_32 = toAddress(0x010000000);
    static readonly DLL_IMAGE_BASE_64 = toAddress(0x180000000);

    protected loadSymbols(libName: string, libStart: Address, libEnd: Address, progress: Progress<string> | undefined, token: CancellationToken | undefined) {
        if (this.targetRootFS) libName = path.resolve(this.targetRootFS, libName);
        const { dir, ext, name, base } = path.parse(libName);
        this.moduleType = ext.toLowerCase();
        // this.aslr = false;
        this.libStart = libStart;
        // this.libEnd = libEnd;
        this._symbols = "";
        this.symbolsFormat = undefined;
        const headers = winnt.getImageHeaders(libName);
        if (!headers) {
            output.warn(`shared library '${libName}' was not a valid PE image.`);
            return;
        }

        this.imageBase = toAddress(headers.OptionalHeader.ImageBase);
        this.parsePos = 0;

        // If we are not explicitly using `dbghelp`, attempt to load a linker map
        if (this.useDbghelp !== true) {
            const mapFileName = path.join(dir, name + ".map");
            try {
                this._symbols = fs.readFileSync(mapFileName, "utf8");
                return
            }
            catch (e: unknown) {
                if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
                    output.warn(`Unable to load symbols from '${mapFileName}':`, e);
                }
            }
        }

        // check for the existence of a .pdb file, if so, we can use `dumpbin /map`
        const pdbFileName = path.join(dir, name + ".pdb");
        const hasPdb = fs.existsSync(pdbFileName);

        // If we are not explicitly using dbghelp, and the workspace is trusted, attempt to generate
        // a linker map equivalent using dumpbin.
        if (this.useDbghelp !== true && workspace.isTrusted) {
            const dumpbin = this.findDumpbinPath();
            if (dumpbin) {
                // create a temporary file to dump symbols.
                const tempFile = this.createTempFile(base);
                if (tempFile) {
                    // TODO: consider caching this for performance?
                    try {
                        // check for the existence of a .pdb file, if so, we can use `dumpbin /map`
                        if (hasPdb) {
                            try {
                                cp.execFileSync(dumpbin, ["/nologo", "/headers", "/map", libName, `/out:${tempFile}`], { encoding: "utf8", stdio: "pipe" });
                                this._symbols = fs.readFileSync(tempFile, { encoding: "utf8" });
                                this.symbolsFormat = "dumpbin-map";
                                return;
                            }
                            catch (e) {
                                output.warn(`Unable to dump symbols from '${pdbFileName}':`, e);
                            }
                        }
                    }
                    finally {
                        try {
                            // clean up temp file
                            fs.unlinkSync(tempFile);
                        }
                        catch (e) {
                            output.warn(`Unable to clean up temp file '${tempFile}':`, e);
                        }
                    }
                }
            }
        }

        // NOTE: Using DbgHelp directly doesn't quite work yet
        if (this.useDbghelp !== false && hasPdb && dbghelp.isAvailable()) {
            for (const { using, fail } of Disposable.scope()) try {
                const deferrals = using(new DisposableStack());
                try {
                    const hProcess = dbghelp.createSimpleHandle();

                    // Initialize dbghelp
                    const fInitialized = dbghelp.SymInitialize(hProcess);
                    if (!fInitialized) {
                        kernel32.Win32Error.throwIfNotSuccess();
                    }
                    else {
                        // Ensure we cleanup dbghelp
                        deferrals.use(() => { if (!dbghelp.SymCleanup(hProcess)) throw new kernel32.Win32Error(); });
                    }

                    let prevOptions = dbghelp.SymGetOptions();
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

                    dbghelp.SymSetOptions(options >>> 0);

                    if (!fInitialized) {
                        // ensure we restore previous options
                        deferrals.use(() => { dbghelp.SymSetOptions(prevOptions); });
                    }

                    // NOTE: This section would allow us to download symbols from the Microsoft public symbol store, but
                    // this can be very slow...
                    if (USE_MS_PUBLIC_SYMBOL_STORE && this.globalStorageUri) {
                        const pSearchPath = Buffer.alloc(260) as PSTR;
                        if (!dbghelp.SymGetSearchPath(hProcess, pSearchPath, 260)) {
                            throw new kernel32.Win32Error();
                        }

                        const searchPath = pSearchPath.readCString();
                        if (!searchPath.includes("https://msdl.microsoft.com/download/symbols")) {
                            const searchPaths = searchPath.length ? searchPath.split(";") : [];
                            const globalStoragePath = this.globalStorageUri.fsPath;
                            const symbolStoragePath = path.join(globalStoragePath, "symbols");
                            try { fs.mkdirSync(symbolStoragePath, { recursive: true }); } catch { }
                            searchPaths.push(`srv*${symbolStoragePath}*https://msdl.microsoft.com/download/symbols`);
                            if (!dbghelp.SymSetSearchPath(hProcess, searchPaths.join(";"))) {
                                throw new kernel32.Win32Error();
                            }
                            deferrals.use(() => { if (!dbghelp.SymSetSearchPath(hProcess, searchPath)) throw new kernel32.Win32Error(); });
                        }
                    }

                    if (progress) {
                        if (!dbghelp.SymRegisterCallback64(hProcess, (_hProcess, ActionCode, CallbackData, _UserContext) => {
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
                    const base = dbghelp.SymLoadModuleEx(
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
                        deferrals.use(() => { if (!dbghelp.SymUnloadModule64(hProcess, base)) throw new kernel32.Win32Error(); });
                    }

                    const moduleInfo = dbghelp.IMAGEHLP_MODULE64({ SizeOfStruct: sizeof(dbghelp.IMAGEHLP_MODULE64) });
                    if (!dbghelp.SymGetModuleInfo64(hProcess, base, moduleInfo.ref())) {
                        kernel32.Win32Error.throwIfNotSuccess();
                    }

                    const symbols: FuncInfo[] = [];
                    if (!dbghelp.SymEnumSymbols(
                        hProcess,
                        base,
                        "*",
                        (pSymbol) => {
                            const symbol = pSymbol.deref();
                            const name = symbol.Name.buffer.readCString();
                            const rva = symbol.Address - symbol.ModBase;
                            const start = this.libStart + rva;
                            const size = symbol.Size ? symbol.Size : undefined;

                            symbols.push({ name, start, size });
                            return true;
                        }, ref.NULL as any as ref.Pointer<null>
                    )) {
                        throw new kernel32.Win32Error();
                    }
                    this._symbols = symbols;
                }
                catch (e) {
                    output.warn(`Unable to load symbols using dbghelp:`, e);
                }
            } catch (e) { fail(e); }
        }
    }

    private createTempFile(base: string) {
        const tmpdir = os.tmpdir();
        for (let i = 0; i < 1_000; i++) {
            const tempFile = path.join(tmpdir, `${base}~${randomInt(0x7fffffff).toString(16).padStart(8, "0")}.dumpbin`);
            try {
                fs.closeSync(fs.openSync(tempFile, fs.constants.O_CREAT));
                return tempFile;
            }
            catch (e: unknown) {
                if ((e as NodeJS.ErrnoException).code === "EEXIST") {
                    // ignore EEXIST
                    continue;
                }
                output.warn("Unable to create temp file:", e);
                break;
            }
        }
    }

    private findDumpbinPath() {
        if (this.dumpbinPath !== undefined) {
            return this.dumpbinPath;
        }

        // try configuration settings
        const dumpbinPath = workspace.getConfiguration("deoptexplorer").get("dumpbinPath", null);
        if (dumpbinPath !== null && fs.existsSync(dumpbinPath)) {
            return this.dumpbinPath = dumpbinPath;
        }

        // search for an installed Visual Studio instance
        const programData = process.env.ProgramData;
        if (programData) {
            const instancesDir = path.join(programData, "Microsoft/VisualStudio/Packages/_Instances");
            const instanceNames = tryReaddirSync(instancesDir);
            if (instanceNames) {
                interface VsInstanceState {
                    installationPath: string;
                    installationVersion: semver.SemVer;
                }

                // discover installed VS installations
                const instances: VsInstanceState[] = [];
                for (const instanceName of instanceNames) {
                    const stateFile = path.join(instancesDir, instanceName, "state.json");
                    try {
                        const state = JSON.parse(fs.readFileSync(stateFile, "utf8")) as VsInstanceState;
                        if (typeof state.installationPath === "string" &&
                            typeof state.installationVersion === "string") {
                            const match = /^\d+\.\d+\.\d+/.exec(state.installationVersion);
                            if (match) {
                                const installationVersion = semver.parse(match[0], { loose: true });
                                if (installationVersion && semver.valid(installationVersion)) {
                                    instances.push({
                                        installationPath: state.installationPath,
                                        installationVersion
                                    });
                                }
                            }
                        }
                    }
                    catch (e) {
                        output.warn(`Unable to read '${stateFile}':`, e);
                    }
                }

                // sort installations in descending order
                instances.sort((a, b) => -a.installationVersion.compare(b.installationVersion));

                // discover MSVC tools locations
                for (const { installationPath } of instances) {
                    const msvcDir = path.join(installationPath, "VC/Tools/MSVC");
                    const versionNames = tryReaddirSync(msvcDir);
                    if (versionNames) {
                        // discover MSVC tools versions
                        const msvcToolsVersions: { name: string, version: semver.SemVer }[] = [];
                        for (const versionName of versionNames) {
                            const match = /^\d+\.\d+\.\d+/.exec(versionName);
                            if (match) {
                                const version = semver.parse(match[0], { loose: true });
                                if (version && semver.valid(version)) {
                                    msvcToolsVersions.push({ name: versionName, version });
                                }
                            }
                        }

                        // sort MSVC tools versions in descending order
                        msvcToolsVersions.sort((a, b) => -a.version.compare(b.version));

                        // discover a recent version of dumpbin.exe
                        for (const { name } of msvcToolsVersions) {
                            const dumpbinPath = path.join(msvcDir, name, "bin/Hostx86/x86/dumpbin.exe");
                            if (fs.existsSync(dumpbinPath)) {
                                return this.dumpbinPath = dumpbinPath;
                            }
                        }
                    }
                }
            }
        }

        // unable to discover dumpbin.exe
        return this.dumpbinPath = null;
    }

    private isValidImageBase(imageBase: bigint) {
        switch (this.moduleType) {
            case ".exe":
                if (imageBase === WindowsCppEntriesProvider.EXE_IMAGE_BASE_32 ||
                    imageBase === WindowsCppEntriesProvider.EXE_IMAGE_BASE_64) {
                    return true;
                }
                break;
            case ".dll":
                if (imageBase === WindowsCppEntriesProvider.DLL_IMAGE_BASE_32 ||
                    imageBase === WindowsCppEntriesProvider.DLL_IMAGE_BASE_64) {
                    return true;
                }
                break;
        }
        return false;
    }

    protected parseNextLine(): FuncInfo | null | false {
        if (this.libStart === kNullAddress) {
            return false;
        }

        if (typeof this._symbols !== "string") {
            if (this.parsePos < this._symbols.length) {
                return this._symbols[this.parsePos++];
            }
            return false;
        }

        const lineEndPos = this._symbols.indexOf('\r\n', this.parsePos);
        if (lineEndPos == -1) {
            return false;
        }

        const line = this._symbols.substring(this.parsePos, lineEndPos).trim();
        this.parsePos = lineEndPos + 2;

        if (this.imageBase != toAddress(0) && !this.imageBaseChecked) {
            this.imageBaseChecked = true;
            if (!this.isValidImageBase(this.imageBase)) {
                return false;
            }
        }

        if (!this.symbolsFormat) {
            if (WindowsCppEntriesProvider.DUMPBIN_MAP_RE.test(line)) {
                this.symbolsFormat = "dumpbin-map";
                return null;
            }
            else {
                // Image base entry is above all other symbols, so we can just
                // terminate parsing.
                const imageBaseFields = line.match(WindowsCppEntriesProvider.IMAGE_BASE_RE);
                if (imageBaseFields) {
                    this.symbolsFormat = "map";
                    if (!this.imageBaseChecked) {
                        this.imageBaseChecked = true;
                        this.imageBase = parseAddress(imageBaseFields[1]);
                        if (!this.isValidImageBase(this.imageBase)) {
                            return false;
                        }
                    }
                }
            }
        }

        if (this.imageBase === kNullAddress) {
            return null;
        }

        const regexp =
            this.symbolsFormat === "dumpbin-map" ? WindowsCppEntriesProvider.DUMPBIN_MAP_FUNC_RE :
            WindowsCppEntriesProvider.FUNC_RE;

        const fields = regexp.exec(line)?.groups;
        if (fields) {
            const name = this.unmangleName(fields.name);
            const rva = fields.rva ? parseAddress(fields.rva) : parseAddress(fields.address) - this.imageBase;
            const start = this.libStart + rva;
            return { name, start };
        }
        return null;
    }

    private undecorateSymbolName(name: string, flags: number) {
        if (dbghelp.isAvailable()) {
            this.symbolNameBuffer ??= Buffer.alloc(4096);
            this.symbolNameBuffer.type ??= ref.types.byte;
            const bytesWritten = dbghelp.UnDecorateSymbolName(
                name,
                this.symbolNameBuffer as ref.Pointer<number>,
                this.symbolNameBuffer.byteLength,
                flags);
            if (bytesWritten > 0) {
                return this.symbolNameBuffer.toString("utf8", 0, +bytesWritten);
            }
        }
    }

    private removeTemplateParameters(name: string) {
        let start = 0;
        let bracketDepth = 0;
        let result = "";
        for (let i = 0; i < name.length; i++) {
            const ch = name.charAt(i);
            if (ch === "<") {
                if (bracketDepth === 0) {
                    result += name.slice(start, i);
                }
                bracketDepth++;
            }
            else if (ch === ">") {
                bracketDepth--;
                if (bracketDepth === 0) {
                    start = i + 1;
                }
            }
        }
        result += name.slice(start);
        return result;
    }

    /**
     * Performs very simple unmangling of C++ names.
     *
     * Does not handle arguments and template arguments. The mangled names have
     * the form:
     *
     *   ?LookupInDescriptor@JSObject@internal@v8@@...arguments info...
     */
    protected unmangleName(name: string) {
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
        let undecorated = this.undecorateSymbolName(name, flags);
        if (undecorated === undefined) {
            const prefix = WindowsCppEntriesProvider.SYMBOL_PREFIX_RE.exec(name);
            if (!prefix) {
                return name;
            }
            const nameEndPos = name.indexOf('@@');
            undecorated = name.slice(prefix[0].length, nameEndPos).split('@').reverse().join("::");
        }
        undecorated = undecorated.replace(/(?<=\W)\s+|\s+(?=\W)/g, "");
        return this.removeTemplates ? this.removeTemplateParameters(undecorated) : undecorated;
    }
}
