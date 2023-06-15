// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Address, parseAddress, toAddress } from "#core/address.js";
import { tryReaddirSync } from "#core/fs.js";
import { output } from "#extension/outputChannel.js";
import { kNullAddress } from "#v8/constants.js";
import { FuncInfo, WindowsCppEntriesProvider as V8WindowsCppEntriesProvider } from "#v8/tools/cppEntriesProvider.js";
import * as cp from "child_process";
import { randomInt } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as semver from "semver";
import { CancellationToken, Progress, Uri, workspace } from "vscode";
import * as winnt from "./api/winnt";
import { tryCreateDbghelpWrapper } from "./dbghelpLoader";

export interface WindowsCppEntriesProviderOptions {
    extensionUri?: Uri;
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
    private libStart = kNullAddress;
    private symbolsFormat: "map" | "dumpbin-map" | undefined;
    private dumpbinPath: string | null | undefined;
    private imageBase = toAddress(0);
    private imageBaseChecked = false;
    private moduleType?: string;
    private globalStorageUri?: Uri;
    private useDbghelp?: boolean;
    private extensionUri?: Uri;
    private dbghelpWrapper: import("./dbghelpWrapper.js").DbghelpWrapper | undefined;

    constructor({ targetRootFS, removeTemplates, globalStorageUri, useDbghelp, dumpbinExe, extensionUri }: WindowsCppEntriesProviderOptions = {}) {
        super({ targetRootFS });
        this.removeTemplates = removeTemplates;
        this.globalStorageUri = globalStorageUri;
        this.extensionUri = extensionUri;
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

    protected async loadSymbols(libName: string, libStart: Address, libEnd: Address, progress: Progress<string> | undefined, token: CancellationToken | undefined) {
        if (this.targetRootFS) {
            libName = path.resolve(this.targetRootFS, libName);
        }

        const { dir, ext, name, base } = path.parse(libName);
        this._symbols = "";
        this.moduleType = ext.toLowerCase();
        this.libStart = libStart;
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

        // If we are explicitly using dbghelp, try to load the FFI
        if (this.useDbghelp === true && hasPdb && !this._symbols && this.extensionUri) {
            this.dbghelpWrapper ??= await tryCreateDbghelpWrapper(this.extensionUri);
            this.dbghelpWrapper?.loadSymbols(libName, libStart, libEnd, {
                progress,
                token,
                globalStorageUri: this.globalStorageUri
            });
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
        if (!this.dbghelpWrapper) {
            return super.unmangleName(name);
        }

        let undecorated = this.dbghelpWrapper.unmangleName(name);
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
