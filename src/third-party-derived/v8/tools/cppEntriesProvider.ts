// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
//
// THIRD PARTY LICENSE NOTICE:
//
// Portions of this code are sourced from V8:
//
// Copyright 2009 the V8 project authors. All rights reserved.
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
//       copyright notice, this list of conditions and the following
//       disclaimer in the documentation and/or other materials provided
//       with the distribution.
//     * Neither the name of Google Inc. nor the names of its
//       contributors may be used to endorse or promote products derived
//       from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

import { Address, parseAddress, toAddress } from "#core/address.js";
import { assert } from "#core/assert.js";
import * as cp from "child_process";
import * as fs from "fs";
import * as os from "os";
import { CancellationToken, Location, Progress, Uri, workspace } from "vscode";

export interface FuncInfo {
    name: string;
    start: Address;
    size?: number;
    end?: Address;
    filePosition?: Location;
}

export class CppEntriesProvider {
    async parseVmSymbols(libName: string, libStart: Address, libEnd: Address, libASLRSlide: number, processorFunc: (name: string, start: Address, end: Address) => void, progress: Progress<string> | undefined, token: CancellationToken | undefined) {
        await this.loadSymbols(libName, libStart, libEnd, progress, token);

        let lastUnknownSize: FuncInfo | undefined;
        let lastAdded: FuncInfo | undefined;

        function inRange(funcInfo: FuncInfo, start: Address, end: Address) {
            assert(end !== undefined);
            assert(funcInfo.end !== undefined);
            return funcInfo.start >= start && funcInfo.end <= end;
        }

        function addEntry(funcInfo: FuncInfo) {
            // Several functions can be mapped onto the same address. To avoid
            // creating zero-sized entries, skip such duplicates.
            // Also double-check that function belongs to the library address space.

            if (lastUnknownSize &&
                lastUnknownSize.start < funcInfo.start) {
                // Try to update lastUnknownSize based on new entries start position.
                lastUnknownSize.end = funcInfo.start;
                if ((!lastAdded || !inRange(lastUnknownSize, lastAdded.start, lastAdded.end!)) &&
                    inRange(lastUnknownSize, libStart, libEnd)) {
                    processorFunc(lastUnknownSize.name, lastUnknownSize.start, lastUnknownSize.end);
                    lastAdded = lastUnknownSize;
                }
            }
            lastUnknownSize = undefined;

            if (funcInfo.end) {
                // Skip duplicates that have the same start address as the last added.
                if ((!lastAdded || lastAdded.start != funcInfo.start) &&
                    inRange(funcInfo, libStart, libEnd)) {
                    processorFunc(funcInfo.name, funcInfo.start, funcInfo.end);
                    lastAdded = funcInfo;
                }
            } else {
                // If a funcInfo doesn't have an end, try to match it up with then next
                // entry.
                lastUnknownSize = funcInfo;
            }
        }

        while (true) {
            let funcInfo = this.parseNextLine();
            if (funcInfo === null) {
                continue;
            }
            else if (funcInfo === false) {
                break;
            }
            if (funcInfo.start < libStart - toAddress(libASLRSlide) &&
                funcInfo.start < libEnd - libStart) {
                funcInfo.start += libStart;
            }
            else {
                funcInfo.start += toAddress(libASLRSlide);
            }
            if (funcInfo.size) {
                funcInfo.end = funcInfo.start + toAddress(funcInfo.size);
            }
            addEntry(funcInfo);
        }
        addEntry({ name: '', start: libEnd } as FuncInfo);
    }

    protected loadSymbols(libName: string, libStart: Address, libEnd: Address, progress: Progress<string> | undefined, token: CancellationToken | undefined): void | Promise<void> {
    }

    protected parseNextLine(): FuncInfo | false | null {
        return false;
    }

    dispose() {
    }
}

export interface UnixCppEntriesProviderOptions {
    nmExec?: string;
    targetRootFS?: string;
    apkEmbeddedLibrary?: string;
}

export class UnixCppEntriesProvider extends CppEntriesProvider {
    parsePos: number;
    nmExec?: string;
    targetRootFS?: string;
    apkEmbeddedLibrary?: string;
    FUNC_RE: RegExp;
    symbols: string[];

    constructor({ nmExec, targetRootFS, apkEmbeddedLibrary }: UnixCppEntriesProviderOptions = {}) {
        super();
        this.symbols = [];
        this.parsePos = 0;
        this.nmExec = nmExec;
        this.targetRootFS = targetRootFS;
        this.apkEmbeddedLibrary = apkEmbeddedLibrary;
        this.FUNC_RE = /^([0-9a-fA-F]{8,16}) ([0-9a-fA-F]{8,16} )?[tTwW] (.*)$/;
    }

    protected loadSymbols(libName: string) {
        this.parsePos = 0;
        if (!workspace.isTrusted) {
            this.symbols = ["", ""];
            return;
        }

        if (this.apkEmbeddedLibrary && libName.endsWith('.apk')) {
            libName = this.apkEmbeddedLibrary;
        }
        if (this.targetRootFS) {
            libName = libName.substring(libName.lastIndexOf('/') + 1);
            libName = this.targetRootFS + libName;
        }
        try {
            if (this.nmExec) {
                this.symbols = [
                    cp.spawnSync(this.nmExec, ['-C', '-n', '-S', libName]).stdout,
                    cp.spawnSync(this.nmExec, ['-C', '-n', '-S', '-D', libName]).stdout
                ];
            }
            else {
                this.symbols = ['', ''];
            }
        } catch {
            // If the library cannot be found on this system let's not panic.
            this.symbols = ['', ''];
        }
    }

    protected parseNextLine(): FuncInfo | null | false {
        if (this.symbols.length == 0) {
            return false;
        }
        var lineEndPos = this.symbols[0].indexOf('\n', this.parsePos);
        if (lineEndPos == -1) {
            this.symbols.shift();
            this.parsePos = 0;
            return this.parseNextLine();
        }

        var line = this.symbols[0].substring(this.parsePos, lineEndPos);
        this.parsePos = lineEndPos + 1;
        var fields = line.match(this.FUNC_RE);
        var funcInfo = null;
        if (fields) {
            funcInfo = { name: fields[3], start: parseAddress(fields[1]) } as FuncInfo;
            if (fields[2]) {
                funcInfo.size = parseInt(fields[2], 16);
            }
        }
        return funcInfo;
    }
}

export class MacCppEntriesProvider extends UnixCppEntriesProvider {
    constructor(options: UnixCppEntriesProviderOptions) {
        super(options);
        // Note an empty group. It is required, as UnixCppEntriesProvider expects 3 groups.
        this.FUNC_RE = /^([0-9a-fA-F]{8,16})() (.*)$/;
    }

    protected loadSymbols(libName: string) {
        this.parsePos = 0;
        if (this.targetRootFS) libName = this.targetRootFS + libName;

        if (!workspace.isTrusted) {
            this.symbols = ["", ""];
            return;
        }

        // It seems that in OS X `nm` thinks that `-f` is a format option, not a
        // "flat" display option flag.
        try {
            if (this.nmExec) {
                this.symbols = [
                    cp.spawnSync(this.nmExec, ["-n", libName]).stdout,
                    ''
                ];
            }
            else {
                this.symbols = ['', ''];
            }
        } catch {
            // If the library cannot be found on this system let's not panic.
            this.symbols = ['', ''];
        }
    }
}

export interface WindowsCppEntriesProviderOptions {
    targetRootFS?: string;
    removeTemplates?: boolean;
    globalStorageUri?: Uri;
    dumpbinExe?: string;
    useDbghelp?: boolean;
    unmangleNames?: boolean;
}

export interface WindowsCppEntriesProviderOptions {
    targetRootFS?: string;
}

export class WindowsCppEntriesProvider extends CppEntriesProvider {
    protected targetRootFS?: string;
    private symbols: string = "";
    protected parsePos: number = 0;
    private moduleType_?: string;

    constructor({ targetRootFS }: WindowsCppEntriesProviderOptions) {
        super();
        this.targetRootFS = targetRootFS;
        this.symbols = '';
        this.parsePos = 0;
    }

    static FILENAME_RE = /^(.*)\.([^.]+)$/;
    static FUNC_RE =
        /^\s+0001:[0-9a-fA-F]{8}\s+([_\?@$0-9a-zA-Z]+)\s+([0-9a-fA-F]{8}).*$/;
    static IMAGE_BASE_RE =
        /^\s+0000:00000000\s+___ImageBase\s+([0-9a-fA-F]{8}).*$/;
    // This is almost a constant on Windows.
    static EXE_IMAGE_BASE = 0x00400000;

    protected loadSymbols(libName: string, libStart: Address, libEnd: Address, progress: Progress<string> | undefined, token: CancellationToken | undefined) {
        libName = this.targetRootFS + libName;
        const fileNameFields = libName.match(WindowsCppEntriesProvider.FILENAME_RE);
        if (!fileNameFields) return;
        const mapFileName = `${fileNameFields[1]}.map`;
        this.moduleType_ = fileNameFields[2].toLowerCase();
        try {
            this.symbols = fs.readFileSync(mapFileName, "utf8");
        } catch (e) {
            // If .map file cannot be found let's not panic.
            this.symbols = '';
        }
    }

    protected parseNextLine() {
        const lineEndPos = this.symbols.indexOf('\r\n', this.parsePos);
        if (lineEndPos == -1) {
            return false;
        }

        const line = this.symbols.substring(this.parsePos, lineEndPos);
        this.parsePos = lineEndPos + 2;

        // Image base entry is above all other symbols, so we can just
        // terminate parsing.
        const imageBaseFields = line.match(WindowsCppEntriesProvider.IMAGE_BASE_RE);
        if (imageBaseFields) {
            const imageBase = parseInt(imageBaseFields[1], 16);
            if ((this.moduleType_ == 'exe') !=
                (imageBase == WindowsCppEntriesProvider.EXE_IMAGE_BASE)) {
                return false;
            }
        }

        const fields = line.match(WindowsCppEntriesProvider.FUNC_RE);
        return fields ?
            { name: this.unmangleName(fields[1]), start: parseAddress(fields[2]) } :
            null;
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
        if (name.length < 1 || name.charAt(0) != '?') return name;
        const nameEndPos = name.indexOf('@@');
        const components = name.substring(1, nameEndPos).split('@');
        components.reverse();
        return components.join('::');
    }
}


export interface CppEntriesProviderOptions extends UnixCppEntriesProviderOptions, WindowsCppEntriesProviderOptions {
}

export function getCppEntriesProvider(options: CppEntriesProviderOptions) {
    switch (os.platform()) {
        case "win32": return new WindowsCppEntriesProvider(options);
        case "darwin": return new MacCppEntriesProvider(options);
        default: return new UnixCppEntriesProvider(options);
    }
}