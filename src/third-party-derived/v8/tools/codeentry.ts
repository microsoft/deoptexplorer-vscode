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

import { Equaler, Equatable } from "@esfx/equatable";
import { Address } from "#core/address.js";
import { assert } from "#core/assert.js";
import type { Script } from "#core/script.js";
import { Sources } from "#core/sources.js";
import { equateNullable, hashNullable } from "#core/utils.js";
import { EntryBase } from "#extension/model/entry.js";
import { FunctionName } from "#extension/model/functionName.js";
import { LocationEqualer } from "#extension/vscode/location.js";
import { Location } from "vscode";
import { CodeEntryAndLineNumber } from "../codeEntryAndLineNumber";
import { kNoColumnInfo, kNoLineNumberInfo, kNoScriptId, kNotInlined } from "../constants";
import type { CodeKind } from "../enums/codeKind";
import { FunctionState } from "../enums/functionState";
import { formatLogEventsAndTags, LogEventsAndTags } from "../enums/logEventsAndTags";
import { ProfileStackTrace } from "../profileStackTrace";
import { SourcePositionTable } from "../sourcePositionTable";

export class CodeEntry extends EntryBase {
    declare kind: "code";

    private static _unresolvedEntry: CodeEntry | undefined;
    private static _programEntry: CodeEntry | undefined;
    private static _idleEntry: CodeEntry | undefined;
    private static _gcEntry: CodeEntry | undefined;
    private static _rootEntry: CodeEntry | undefined;
    private static _hiddenEntry: CodeEntry | undefined;

    used?: boolean;
    bailout_reason?: string;
    code_kind?: CodeKind;
    line_info?: SourcePositionTable;
    start_pos?: number;
    end_pos?: number;
    script?: Script;

    private nameUpdated_: boolean;
    private inline_stacks_?: Map<number, ProfileStackTrace>;
    private _functionName?: FunctionName;

    /**
     * Creates a code entry object.
     *
     * @param {number} size Code entry size in bytes.
     * @param {string} opt_name Code entry name.
     * @param {string} opt_type Code entry type, e.g. SHARED_LIB, CPP.
     */
    constructor(
        public size: number,
        public name: string = "",
        public type: string = "",
        sources?: Sources,
    ) {
        super(sources, /*filePosition*/ undefined);
        this.used = undefined;
        this.nameUpdated_ = false;
        if (new.target === CodeEntry) {
            this.finishInitialize();
        }
    }

    /**
     * Gets the script ID for the code entry.
     */
    get scriptId() {
        return this.script?.scriptId ?? kNoScriptId;
    }

    /**
     * Gets the parsed function name for the code entry.
     */
    get functionName() {
        if (!this._functionName) throw new TypeError("'finishInitialize' was not properly called by a subclass.");
        return this._functionName;
    }

    /**
     * 1-based line number ({@link kNoLineNumberInfo} if no line)
     */
    get line_number() {
        return this.filePosition ? this.filePosition.range.start.line + 1 : kNoLineNumberInfo;
    }

    /**
     * 1-based column number ({@link kNoColumnInfo} if no column)
     */
    get column_number() {
        return this.filePosition ? this.filePosition.range.start.character + 1 : kNoColumnInfo;
    }

    getName() {
        return this.name;
    }

    getRawName() {
        return this.name;
    }

    toString () {
        return this.name + ': ' + this.size.toString(16);
    }

    isJSFunction?(): this is DynamicFuncCodeEntry;

    getSourceLine(pc_offset: Address) {
        return this.line_info?.getSourceLineNumber(pc_offset) ?? kNoLineNumberInfo;
    }

    setInlineStacks(inline_stacks: Map<number, ProfileStackTrace>) {
        this.inline_stacks_ = inline_stacks;
    }

    getInlineStack(pc_offset: Address) {
        let inlining_id = this.line_info?.getInliningId(pc_offset) ?? kNotInlined;
        if (inlining_id === kNotInlined) return undefined;
        assert(this.inline_stacks_);
        return this.inline_stacks_.get(inlining_id);
    }

    * inlines(): Iterable<[inliningId: number, entry: CodeEntryAndLineNumber]> {
        if (this.inline_stacks_) {
            for (const [inliningId, stack] of this.inline_stacks_) {
                for (const entry of stack) {
                    yield [inliningId, entry];
                }
            }
        }
    }

    protected finishInitialize() {
        this._functionName =
            this.type === "SHARED_LIB" ? undefined :
            this.type === "RegExp" ? new FunctionName(this.getRawName(), undefined) :
            FunctionName.parse(this.getRawName());
    }

    static root_entry() {
        return CodeEntry._rootEntry ??= new CodeEntry(0, "(root)", formatLogEventsAndTags(LogEventsAndTags.FUNCTION_TAG));
    }

    static gc_entry() {
        return CodeEntry._gcEntry ??= new CodeEntry(0, "(gc)", formatLogEventsAndTags(LogEventsAndTags.BUILTIN_TAG));
    }

    static idle_entry() {
        return CodeEntry._idleEntry ??= new CodeEntry(0, "(idle)", formatLogEventsAndTags(LogEventsAndTags.FUNCTION_TAG));
    }

    static program_entry() {
        return CodeEntry._programEntry ??= new CodeEntry(0, "(program)", formatLogEventsAndTags(LogEventsAndTags.FUNCTION_TAG));
    }

    static unresolved_entry() {
        return CodeEntry._unresolvedEntry ??= new CodeEntry(0, "(unresolved function)", formatLogEventsAndTags(LogEventsAndTags.FUNCTION_TAG));
    }

    static hidden_entry() {
        return CodeEntry._hiddenEntry ??= new CodeEntry(0, "(hidden)", formatLogEventsAndTags(LogEventsAndTags.FUNCTION_TAG));
    }

    isSameFunctionAs(other: CodeEntry) {
        if (this === other) return true;
        if (this.scriptId !== kNoScriptId) {
            return this.scriptId === other.scriptId
                && this.start_pos === other.start_pos;
        }
        return this.name === other.name
            && this.type === other.type
            && equateNullable(this.filePosition, other.filePosition, LocationEqualer);
    }

    equals(other: CodeEntry) {
        return this.isSameFunctionAs(other);
    }

    hash() {
        let hc = 0;
        hc = Equaler.combineHashes(hc, hashNullable(this.type));
        if (this.scriptId !== kNoScriptId) {
            hc = Equaler.combineHashes(hc, hashNullable(this.scriptId));
            hc = Equaler.combineHashes(hc, hashNullable(this.start_pos));
        }
        else {
            hc = Equaler.combineHashes(hc, hashNullable(this.name));
            hc = Equaler.combineHashes(hc, hashNullable(this.filePosition, LocationEqualer));
        }
        return hc;
    }

    [Equatable.equals](other: unknown) { return other instanceof CodeEntry && this.equals(other); }
    [Equatable.hash]() { return this.hash(); }
}

CodeEntry.prototype.kind = "code";

export class DynamicCodeEntry extends CodeEntry {
    declare private _dynamicCodeEntryBrand: never;

    /**
     * Creates a dynamic code entry.
     *
     * @param {number} size Code size.
     * @param {string} type Code type.
     * @param {string} name Function name.
     */
    constructor(sources: Sources | undefined, size: number, type: string, name: string) {
        super(size, name, type, sources);
        if (new.target === DynamicCodeEntry) {
            this.finishInitialize();
        }
    }

    /**
     * Returns node name.
     */
    getName() {
        return this.type + ': ' + this.name;
    }

    /**
     * Returns raw node name (without type decoration).
     */
    getRawName() {
        return this.name;
    }

    isJSFunction(): this is DynamicFuncCodeEntry {
        return false;
    }

    toString() {
        return this.getName() + ': ' + this.size.toString(16);
    }
}

export class DynamicFuncCodeEntry extends DynamicCodeEntry {
    func: SharedFunctionCodeEntry;
    state: FunctionState;
    fallbackFilePosition?: Location;

    /**
     * Creates a dynamic code entry.
     *
     * @param size Code size.
     * @param type Code type.
     * @param func Shared function entry.
     * @param state Code optimization state.
     */
    constructor(sources: Sources | undefined, size: number, type: string, func: SharedFunctionCodeEntry, state: FunctionState) {
        super(sources, size, type, /*name*/ '');
        this.func = func;
        this.state = state;
        this.finishInitialize();
    }

    get filePosition() { return super.filePosition ?? this.func.filePosition ?? this.fallbackFilePosition; }
    set filePosition(value) { super.filePosition = value; }

    get generatedFilePosition() { return super.generatedFilePosition ?? this.func.generatedFilePosition; }
    set generatedFilePosition(value) { super.generatedFilePosition = value; }

    /**
     * Returns state.
     */
    getState() {
        return this.state;
    }

    /**
     * Returns node name.
     */
    getName() {
        let name = this.func.getName();
        return this.type + ': ' + this.getState() + name;
    }

    /**
     * Returns raw node name (without type decoration).
     */
    getRawName() {
        return this.func.getName();
    }

    isJSFunction(): this is DynamicFuncCodeEntry {
        return true;
    }
}

export class SharedFunctionCodeEntry extends CodeEntry {
    private static _sfiUnresolvedEntry: SharedFunctionCodeEntry | undefined;
    declare private _sharedFunctionCodeEntryBrand: never;

    /**
     * Creates a shared function object entry.
     *
     * @param name Function name.
     */
    constructor(sources: Sources | undefined, name: string) {
        super(4, name, /*type*/ undefined, sources);
        this.finishInitialize();
    }

    static unresolved_entry() { return SharedFunctionCodeEntry._sfiUnresolvedEntry ??= Object.assign(new SharedFunctionCodeEntry(/*sources*/ undefined, "(unresolved function)"), { type: formatLogEventsAndTags(LogEventsAndTags.FUNCTION_TAG) }); }

    /**
     * Returns node name.
     */
    getName() {
        let name = this.name;
        if (name.length === 0) {
            name = '(anonymous)';
        }
        else if (name.charAt(0) === ' ') {
            // An anonymous function with location: " aaa.js:10".
            name = '(anonymous)' + name;
        }
        return name;
    }
}
