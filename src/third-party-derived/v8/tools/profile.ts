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

import { ref, Reference } from "@esfx/ref";
import { Address } from "#core/address.js";
import { assert, assertNever } from "#core/assert.js";
import { tryReadFileAsync } from "#core/fs.js";
import { Script } from "#core/script.js";
import { Sources } from "#core/sources.js";
import { TimeDelta, TimeTicks } from "#core/time.js";
import { ViewFilter, ViewFilterOptions } from "#extension/components/v8/viewFilter.js";
import { ProfileShowMode } from "#extension/constants.js";
import { getCanonicalUri } from "#extension/services/canonicalPaths.js";
import { formatUri } from "#extension/vscode/uri.js";
import { EventEmitter, Location, Uri } from "vscode";
import { CodeEntryAndLineNumber } from "../codeEntryAndLineNumber";
import { kNoLineNumberInfo, kNoScriptInfo, kNoSourcePosition, kNotInlined, kNullAddress } from "../constants";
import { DeoptimizationData } from "../deoptimizationData";
import { DeoptimizeKind } from "../enums/deoptimizeKind";
import { FunctionState } from "../enums/functionState";
import { VmState } from "../enums/vmState";
import { ProfileStackTrace } from "../profileStackTrace";
import { SourcePosition } from "../sourcePosition";
import { SourcePositionInfo } from "../sourcePositionInfo";
import { SourcePositionTable } from "../sourcePositionTable";
import { sourcePositionTableIterator } from "../sourcePositionTableIterator";
import { SymbolizedSample } from "../symbolizedSample";
import { TickSample } from "../tickSample";
import { CallTree, CallTreeNode } from "./calltree";
import { CEntryNode } from "./centrynode";
import { CodeEntry, DynamicCodeEntry, DynamicFuncCodeEntry, SharedFunctionCodeEntry } from "./codeentry";
import { CodeMap } from "./codemap";
import { ViewBuilder } from "./profile_view";
import { JsonProfile, JsonProfileCallFrame, JsonProfileNode, JsonProfilePositionTickInfo, SampleInfo } from "./types";

export interface ProfileOptions {
    codeMap?: CodeMap;
    sources?: Sources;
    callTree?: CallTree;
    excludeIc?: boolean;
    excludeBytecodes?: boolean;
    excludeBuiltins?: boolean;
    excludeStubs?: boolean;
    excludeNatives?: boolean;
}

const IC_RE = /^(LoadGlobalIC: )|(Handler: )|(?:CallIC|LoadIC|StoreIC)|(?:Builtin: (?:Keyed)?(?:Load|Store)IC_)/;
const BYTECODES_RE = /^(BytecodeHandler: )/;
const BUILTINS_RE = /^(Builtin: )/;
const STUBS_RE = /^(Stub: )/;
const NATIVES_RE = /\.(exe|dll)$/i;

/**
 * Creates a profile object for processing profiling-related events
 * and calculating function execution times.
 */
export class Profile {
    protected codeMap_: CodeMap;
    protected topDownTree_: CallTree;

    private onUnknownCodeEmitter_ = new EventEmitter<{ operation: "move" | "delete" | "tick", address: Address, stackPos?: number | undefined }>();
    readonly onUnknownCode = this.onUnknownCodeEmitter_.event;

    private onErrorEmitter_ = new EventEmitter<string>();
    readonly onError = this.onErrorEmitter_.event;

    private c_entries_: Record<string, number> = Object.create(null);
    private sources_: Sources;
    private start_time_: TimeTicks | undefined;
    private end_time_: TimeTicks | undefined;
    private duration_: TimeDelta | undefined;
    private averageSampleDuration_: TimeDelta | undefined;
    private samples_: SampleInfo[] = [];
    private skipThisFunctionRegExps_: RegExp[] = [];
    private finalized_ = false;
    private programWeight_ = 0;
    private idleWeight_ = 0;
    private gcWeight_ = 0;
    private functionWeight_ = 0;

    constructor(options: ProfileOptions = {}) {
        if (options.excludeIc) this.skipThisFunctionRegExps_.push(IC_RE);
        if (options.excludeBytecodes) this.skipThisFunctionRegExps_.push(BYTECODES_RE);
        if (options.excludeBuiltins) this.skipThisFunctionRegExps_.push(BUILTINS_RE);
        if (options.excludeStubs) this.skipThisFunctionRegExps_.push(STUBS_RE);
        if (options.excludeNatives) this.skipThisFunctionRegExps_.push(NATIVES_RE);
        this.codeMap_ = options.codeMap ?? new CodeMap();
        this.topDownTree_ = options.callTree ?? new CallTree();
        this.sources_ = options.sources ?? new Sources();
    }

    get startTime() { return this.start_time_ ?? TimeTicks.Zero; }
    get endTime() { return this.end_time_ ?? TimeTicks.Zero; }
    get duration() { return this.duration_ ??= this.endTime.subtract(this.startTime); }
    get averageSampleDuration() { return this.averageSampleDuration_ ??= this.duration.divide(this.samples.length); }
    get samples(): readonly SampleInfo[] { return this.samples_; }
    get totalProgramTime() { return this.averageSampleDuration.multiply(this.programWeight_); }
    get totalIdleTime() { return this.averageSampleDuration.multiply(this.idleWeight_); }
    get totalGcTime() { return this.averageSampleDuration.multiply(this.gcWeight_); }
    get totalFunctionTime() { return this.averageSampleDuration.multiply(this.functionWeight_); }

    /**
     * Returns whether a function with the specified name must be skipped.
     * Should be overriden by subclasses.
     *
     * @param name Function name.
     * @virtual
     */
    skipThisFunction(name: string) {
        for (let i = 0; i < this.skipThisFunctionRegExps_.length; i++) {
            if (this.skipThisFunctionRegExps_[i].test(name)) return true;
        }
        return false;
    }

    /**
     * Called whenever the specified operation has failed finding a function
     * containing the specified address. Should be overriden by subclasses.
     * See the Profile.Operation enum for the list of
     * possible operations.
     *
     * @param operation Operation.
     * @param address Address of the unknown code.
     * @param opt_stackPos If an unknown address is encountered
     *     during stack strace processing, specifies a position of the frame
     *     containing the address.
     * @virtual
     */
    handleUnknownCode(operation: "move" | "delete" | "tick", address: Address, opt_stackPos?: number) {
        this.onUnknownCodeEmitter_.fire({ operation, address, stackPos: opt_stackPos });
    }

    handleError(message: string) {
        this.onErrorEmitter_.fire(message);
    }

    /**
     * Registers a library.
     *
     * @param name Code entry name.
     * @param startAddr Starting address.
     * @param endAddr Ending address.
     */
    addLibrary(name: string, startAddr: Address, endAddr: Address) {
        this.throwIfFinalized_();
        let entry = new CodeEntry(Number(endAddr - startAddr), name, 'SHARED_LIB');
        this.codeMap_.addLibrary(startAddr, entry);
        return entry;
    }

    /**
     * Registers statically compiled code entry.
     *
     * @param name Code entry name.
     * @param startAddr Starting address.
     * @param endAddr Ending address.
     */
    addStaticCode(name: string, startAddr: Address, endAddr: Address) {
        this.throwIfFinalized_();
        let entry = new CodeEntry(Number(endAddr - startAddr), name, 'CPP');
        this.codeMap_.addStaticCode(startAddr, entry);
        return entry;
    }

    /**
     * Registers dynamic (JIT-compiled) code entry.
     *
     * @param type Code entry type.
     * @param name Code entry name.
     * @param start Starting address.
     * @param size Code entry size.
     */
    addCode(type: string, name: string, timestamp: TimeTicks, start: Address, size: number) {
        this.throwIfFinalized_();
        let entry = new DynamicCodeEntry(this.sources_, size, type, name);
        this.codeMap_.addCode(start, entry);
        return entry;
    }

    /**
     * Registers dynamic (JIT-compiled) code entry.
     *
     * @param {string} type Code entry type.
     * @param {string} name Code entry name.
     * @param {number} start Starting address.
     * @param {number} size Code entry size.
     * @param {number} funcAddr Shared function object address.
     * @param {Profile.CodeState} state Optimization state.
     */
    addFuncCode(type: string, name: string, timestamp: TimeTicks, start: Address, size: number, funcAddr: Address, state: FunctionState) {
        this.throwIfFinalized_();
        // As code and functions are in the same address space,
        // it is safe to put them in a single code map.
        let func = this.codeMap_.findDynamicEntryByStartAddress(funcAddr);
        if (!func) {
            func = new SharedFunctionCodeEntry(this.sources_, name);
            this.codeMap_.addCode(funcAddr, func);
        }
        else if (func.name !== name) {
            // Function object has been overwritten with a new one.
            func.name = name;
        }
        let entry = this.codeMap_.findDynamicEntryByStartAddress(start);
        if (entry) {
            if (entry.size === size && entry?.isJSFunction?.() && entry.func === func) {
                // Entry state has changed.
                entry.state = state;
            }
            else {
                this.codeMap_.deleteCode(start);
                entry = null;
            }
        }
        if (!entry) {
            assert(func instanceof SharedFunctionCodeEntry);
            entry = new DynamicFuncCodeEntry(this.sources_, size, type, func, state);
            this.codeMap_.addCode(start, entry);
        }
        return entry;
    }

    /**
     * Adds script source code.
     */
    addScriptSource(scriptId: number, url: Uri | undefined, source: string) {
        this.throwIfFinalized_();
        this.sources_.addScript(new Script(scriptId, url, source));
    }

    /**
     * Adds source positions for given code.
     */
    addSourcePositions(startAddress: Address, scriptId: number, startPos: number, endPos: number, sourcePositions: string, inliningPositions: string, inlinedFunctions: string) {
        this.throwIfFinalized_();
        const entry = this.codeMap_.findDynamicEntryByStartAddress(startAddress);
        if (!entry) return;

        const script = this.sources_.getScriptById(scriptId);
        if (!script) {
            // The script was not part of the trace, so try loading it from the file system.
            const { filePosition: location } = entry.functionName;
            const uri = location && getCanonicalUri(location.uri);
            if (uri) {
                return tryReadFileAsync(uri).then(text => {
                    let script: Script | undefined;
                    if (text !== undefined) {
                        script = new Script(scriptId, uri, text);
                        this.sources_.addScript(script);
                    }
                    this.addSourcePositionsWorker(entry, script, startPos, endPos, sourcePositions, inliningPositions, inlinedFunctions);
                });
            }
        }
        return this.addSourcePositionsWorker(entry, script, startPos, endPos, sourcePositions, inliningPositions, inlinedFunctions);
    }

    private addSourcePositionsWorker(entry: DynamicCodeEntry | SharedFunctionCodeEntry, script: Script | undefined, startPos: number, endPos: number, sourcePositions: string, inliningPositions: string, inlinedFunctions: string) {
        entry.start_pos ??= startPos;
        entry.end_pos ??= endPos;
        entry.script ??= script;
        entry.filePosition ??= script?.uri && new Location(script.uri, script.lineMap.positionAt(startPos));

        if (!entry?.isJSFunction?.()) return;

        entry.func.script ??= script;
        entry.func.start_pos ??= startPos;
        entry.func.end_pos ??= endPos;
        entry.func.filePosition ??= entry.filePosition;

        const line_table = new SourcePositionTable();
        const inline_stacks = new Map<number, ProfileStackTrace>();
        const cached_inline_entries = new Map<string, DynamicFuncCodeEntry>();
        const source_positions = [...sourcePositionTableIterator(sourcePositions)];
        const deopt_data = DeoptimizationData.deserialize(inliningPositions, inlinedFunctions, this.codeMap_, entry.func);

        for (const it of source_positions) {
            let { codeOffset: code_offset, sourcePosition: source_position } = it;
            let { scriptOffset, inliningId: inlining_id } = source_position;

            if (inlining_id === kNotInlined) {
                let line_number = script?.getV8LineNumber(scriptOffset) ?? 1;
                line_table.setPosition(code_offset, line_number, inlining_id);
            }
            else {
                const stack = source_position.inliningStack(deopt_data);
                assert(stack.length);

                // When we have an inlining id and we are doing cross-script inlining,
                // then the script of the inlined frames may be different to the script
                // of |shared|.

                // v8 lines are 1-based, vscode positions are 0-based.
                let line_number = stack[0].position ? stack[0].position.line + 1 : 1;
                line_table.setPosition(code_offset, line_number, inlining_id);

                let inline_stack: ProfileStackTrace = [];
                for (const pos_info of stack) {
                    if (pos_info.sourcePosition.scriptOffset === kNoSourcePosition) continue;
                    if (!pos_info.script) continue;

                    let line_number = pos_info.script.getV8LineNumber(pos_info.sourcePosition.scriptOffset);

                    // We need the start line number and column number of the function for
                    // kLeafNodeLineNumbers mode. Creating a SourcePositionInfo is a handy
                    // way of getting both easily.
                    let start_pos_info = new SourcePositionInfo(
                        new SourcePosition(pos_info.shared.start_pos ?? kNoSourcePosition),
                        pos_info.shared,
                        pos_info.script);

                    let cache_key = `(${entry.type})(${pos_info.shared.getName()})(${pos_info.script.scriptId})(${pos_info.sourcePosition.scriptOffset})(${pos_info.sourcePosition.inliningId})`;
                    let inline_entry = cached_inline_entries.get(cache_key);
                    if (!inline_entry) {
                        inline_entry = new DynamicFuncCodeEntry(this.sources_, 0, entry.type, pos_info.shared, FunctionState.Inlined);
                        inline_entry.fallbackFilePosition = start_pos_info.position && pos_info.script.uri && new Location(pos_info.script.uri, start_pos_info.position);
                        inline_entry.start_pos = pos_info.shared.start_pos;
                        inline_entry.end_pos = pos_info.shared.end_pos;
                        inline_entry.script = pos_info.script;
                        cached_inline_entries.set(cache_key, inline_entry);
                    }
                    inline_stack.push(new CodeEntryAndLineNumber(inline_entry, line_number));
                }
                inline_stacks.set(inlining_id, inline_stack);
            }
        }
        entry.line_info = line_table;
        entry.setInlineStacks(inline_stacks);
    }

    /**
     * Reports about moving of a dynamic code entry.
     *
     * @param from Current code entry address.
     * @param to New code entry address.
     */
    moveCode(from: Address, to: Address) {
        this.throwIfFinalized_();
        try {
            this.codeMap_.moveCode(from, to);
        }
        catch (e) {
            this.handleUnknownCode("move", from);
        }
    }

    /**
     * Reports about moving of a dynamic code entry.
     *
     * @param from Current code entry address.
     * @param to New code entry address.
     */
    moveFunc(from: Address, to: Address) {
        this.throwIfFinalized_();
        if (this.codeMap_.findDynamicEntryByStartAddress(from)) {
            this.codeMap_.moveCode(from, to);
        }
    }

    /**
     * Reports about deletion of a dynamic code entry.
     *
     * @param start Starting address.
     */
    deleteCode(start: Address) {
        this.throwIfFinalized_();
        try {
            this.codeMap_.deleteCode(start);
        }
        catch (e) {
            this.handleUnknownCode("delete", start);
        }
    }

    deoptCode(timestamp: TimeTicks, code: Address, inliningId: number, scriptOffset: number, bailoutType: DeoptimizeKind, sourcePositionText: string, deoptReasonText: string) {
        this.throwIfFinalized_();
    }

    /**
     * Records a tick event. Stack must contain a sequence of
     * addresses starting with the program counter value.
     */
    recordTick(sample: TickSample) {
        this.throwIfFinalized_();
        if (!this.start_time_ || this.start_time_.compareTo(sample.timestamp) > 0) this.start_time_ = sample.timestamp;
        if (!this.end_time_ || this.end_time_.compareTo(sample.timestamp) < 0) this.end_time_ = sample.timestamp;
        this.duration_ = undefined;
        this.averageSampleDuration_ = undefined;
        const { stack_trace, src_line } = this.symbolizeTickSample_(sample);
        const node = this.topDownTree_.addPathFromEnd(stack_trace, src_line);
        this.samples_.push(new SampleInfo(node, sample.timestamp, src_line));
        switch (node.entry) {
            case CodeEntry.root_entry():
                break;
            case CodeEntry.program_entry():
                this.programWeight_++;
                break;
            case CodeEntry.gc_entry():
                this.gcWeight_++;
                break;
            case CodeEntry.idle_entry():
                this.idleWeight_++;
                break;
            default:
                this.functionWeight_++;
                break;
        }
    }

    private symbolizeTickSample_(sample: TickSample): SymbolizedSample {
        const stack_trace: ProfileStackTrace = [];
        let last_seen_c_function = '';
        let look_for_first_c_function = false;
        let frame_id = 0;

        const pushEntry = (frame: CodeEntryAndLineNumber) => {
            if (!this.skipThisFunction(frame.code_entry.getName())) {
                stack_trace.push(frame);
            }
        };

        const pushFrame = (address: Address, entry: CodeEntry | null, line_number: number) => {
            const this_frame_id = frame_id++;
            if (entry) {
                if (this_frame_id === 0 && (entry.type === "CPP" || entry.type === "SHARED_LIB")) {
                    look_for_first_c_function = true;
                }
                if (look_for_first_c_function && entry.type === "CPP") {
                    last_seen_c_function = entry.getName();
                }
                pushEntry(new CodeEntryAndLineNumber(entry, line_number));
            }
            else {
                this.handleUnknownCode("tick", address, this_frame_id);
            }
            if (look_for_first_c_function &&
                this_frame_id > 0 &&
                (!entry || entry.type !== "CPP") &&
                last_seen_c_function !== "") {
                this.c_entries_[last_seen_c_function] ??= 0;
                this.c_entries_[last_seen_c_function]++;
                look_for_first_c_function = false;
            }
        };

        // The ProfileNode knows nothing about all versions of generated code for
        // the same JS function. The line number information associated with
        // the latest version of generated code is used to find a source line number
        // for a JS function. Then, the detected source line is passed to
        // ProfileNode to increase the tick count for this source line.
        let src_line = kNoLineNumberInfo;
        let src_line_not_found = true;
        if (sample.pc) {
            if (sample.has_external_callback && sample.state === VmState.External) {
                const entry = this.findEntry(sample.external_callback_entry);
                // if (entry?.type === "SHARED_LIB" && entry.name.includes("node.exe")) debugger;
                // Don't use PC when in external callback code, as it can point
                // inside a callback's code, and we will erroneously report
                // that a callback calls itself.
                pushFrame(sample.external_callback_entry, entry, kNoLineNumberInfo);
            }
            else {
                let attributed_pc = sample.pc as Address;
                let pc_entry_instruction_start = kNullAddress;
                const ref_pc_entry_instruction_start = ref(() => pc_entry_instruction_start, _ => pc_entry_instruction_start = _);
                let pc_entry = this.findEntry(attributed_pc, ref_pc_entry_instruction_start);
                // if (pc_entry?.type === "SHARED_LIB" && pc_entry.name.includes("node.exe")) debugger;
                // If there is no pc_entry, we're likely in native code. Find out if the
                // top of the stack (the return address) was pointing inside a JS
                // function, meaning that we have encountered a frameless invocation.
                if (!pc_entry && !sample.has_external_callback) {
                    attributed_pc = sample.tos;
                    pc_entry = this.findEntry(attributed_pc, ref_pc_entry_instruction_start);
                    // if (pc_entry?.type === "SHARED_LIB" && pc_entry.name.includes("node.exe")) debugger;
                }
                // If pc is in the function code before it set up stack frame or after the
                // frame was destroyed, SafeStackFrameIterator incorrectly thinks that
                // ebp contains the return address of the current function and skips the
                // caller's frame. Check for this case and just skip such samples.
                if (pc_entry) {
                    let pc_offset = attributed_pc - pc_entry_instruction_start;
                    src_line = pc_entry.getSourceLine(pc_offset);
                    if (src_line === kNoLineNumberInfo) {
                        src_line = pc_entry.line_number;
                    }
                    src_line_not_found = false;
                    pushFrame(attributed_pc, pc_entry, src_line);
                    if (pc_entry.type === "Builtin" && (
                        pc_entry.name === "FunctionPrototypeApply" ||
                        pc_entry.name === "FunctionPrototypeCall")) {
                        // When current function is either the Function.prototype.apply or the
                        // Function.prototype.call builtin the top frame is either frame of
                        // the calling JS function or internal frame.
                        // In the latter case we know the caller for sure but in the
                        // former case we don't so we simply replace the frame with
                        // 'unresolved' entry.
                        if (!sample.has_external_callback) {
                            pushFrame(kNullAddress, CodeEntry.unresolved_entry(), kNoLineNumberInfo);
                        }
                    }
                }
            }

            for (let i = 0; i < sample.frame_count; i++) {
                let stack_pos = sample.stack[i];
                let instruction_start = kNullAddress;
                const ref_instruction_start = ref(() => instruction_start, _ => instruction_start = _);
                let entry = this.findEntry(stack_pos, ref_instruction_start);
                // if (entry?.type === "SHARED_LIB" && entry.name.includes("node.exe")) debugger;
                let line_number = kNoLineNumberInfo;
                if (entry) {
                    // Find out if the entry has an inlining stack associated.
                    let pc_offset = stack_pos - instruction_start;
                    // TODO(petermarshall): pc_offset can still be negative in some cases.
                    let inline_stack = entry.getInlineStack(pc_offset);
                    if (inline_stack) {
                        let most_inlined_frame_line_number = entry.getSourceLine(pc_offset);
                        for (const entry of inline_stack) {
                            pushEntry(entry);
                        }
                        // This is a bit of a messy hack. The line number for the most-inlined
                        // frame (the function at the end of the chain of function calls) has
                        // the wrong line number in inline_stack. The actual line number in
                        // this function is stored in the SourcePositionTable in entry. We fix
                        // up the line number for the most-inlined frame here.
                        // TODO(petermarshall): Remove this and use a tree with a node per
                        // inlining_id.
                        assert(inline_stack.length);
                        let index = stack_trace.length - inline_stack.length;
                        stack_trace[index].line_number = most_inlined_frame_line_number;
                    }
                    // Skip unresolved frames (e.g. internal frame) and get source line of
                    // the first JS caller.
                    if (src_line_not_found) {
                        src_line = entry.getSourceLine(pc_offset);
                        if (src_line === kNoLineNumberInfo) {
                            src_line = entry.line_number;
                        }
                        src_line_not_found = false;
                    }
                    line_number = entry.getSourceLine(pc_offset);

                    // The inline stack contains the top-level function i.e. the same
                    // function as entry. We don't want to add it twice. The one from the
                    // inline stack has the correct line number for this particular inlining
                    // so we use it instead of pushing entry to stack_trace.
                    if (inline_stack) continue;
                }
                pushFrame(stack_pos, entry, line_number);
            }
        }

        if (!stack_trace.length) {
            pushFrame(kNullAddress, this.entryForVmState_(sample.state), kNoLineNumberInfo);
        }

        return new SymbolizedSample(stack_trace, src_line);
    }

    private entryForVmState_(state: VmState) {
        switch (state) {
            case VmState.GarbageCollector:
                return CodeEntry.gc_entry();
            case VmState.ScriptExecution:
            case VmState.Parser:
            case VmState.Compiler:
            case VmState.BytecodeCompiler:
            case VmState.AtomicsWait:
            case VmState.Other:
            case VmState.External:
                return CodeEntry.program_entry();
            case VmState.Idle:
                return CodeEntry.idle_entry();
            default:
                return assertNever(state);
        }
    }

    /**
     * Retrieves a code entry by an address.
     *
     * @param addr Entry address.
     */
    findEntry(addr: Address, out_instruction_start?: Reference<Address>) {
        return this.codeMap_.findEntry(addr, out_instruction_start);
    }

    /**
     * Calculates a top down profile for a node with the specified label.
     * If no name specified, returns the whole top down calls tree.
     */
    getTopDownProfile() {
        this.throwIfNotFinalized_();
        return this.topDownTree_;
    }

    getCEntryProfile() {
        this.throwIfNotFinalized_();
        let result = [new CEntryNode("TOTAL", 0)];
        let total_ticks = 0;
        for (var f in this.c_entries_) {
            let ticks = this.c_entries_[f];
            total_ticks += ticks;
            result.push(new CEntryNode(f, ticks));
        }
        result[0].ticks = total_ticks; // Sorting will keep this at index 0.
        result.sort(function (n1, n2) {
            return n2.ticks - n1.ticks || (n2.name < n1.name ? -1 : 1);
        });
        return result;
    }

    getProfileView(showAs: ProfileShowMode, filters?: ViewFilterOptions) {
        const topDown = this.getTopDownProfile();
        const viewBuilder = new ViewBuilder(this.averageSampleDuration.inMillisecondsF());
        const viewFilter = new ViewFilter(filters)
        return viewBuilder.buildView(viewFilter.applyFilter(topDown), showAs);
    }

    getCallTreeView(filters?: ViewFilterOptions) {
        return this.getProfileView(ProfileShowMode.CallTree, filters);
    }

    getBottomUpView(filters?: ViewFilterOptions) {
        return this.getProfileView(ProfileShowMode.BottomUp, filters);
    }

    getFlatView(filters?: ViewFilterOptions) {
        return this.getProfileView(ProfileShowMode.Flat, filters);
    }

    dynamicCodeEntries() {
        return this.codeMap_.getAllDynamicEntries();
    }

    staticCodeEntries() {
        return this.codeMap_.getAllStaticEntries();
    }

    private throwIfFinalized_() {
        if (this.finalized_) throw new Error("Cannot modify a finalized profile.");
    }

    private throwIfNotFinalized_() {
        if (!this.finalized_) throw new Error("Profile must be finalized first.");
    }

    finalize() {
        if (this.finalized_) return;
        this.finalized_ = true;
        this.cleanUpFuncEntries();
        this.fixMissingSamples();
        this.topDownTree_.computeTotalWeights();
    }

    /**
     * Cleans up function entries that are not referenced by code entries.
     */
    private cleanUpFuncEntries() {
        let entries = this.codeMap_.getAllDynamicEntriesWithAddresses();
        for (let i = 0, l = entries.length; i < l; ++i) {
            const entry = entries[i][1];
            if (entry instanceof SharedFunctionCodeEntry) {
                entry.used = false;
            }
        }
        for (let i = 0, l = entries.length; i < l; ++i) {
            const entry = entries[i][1];
            if (entry?.isJSFunction?.()) {
                entry.func.used = true;
            }
        }
        for (let i = 0, l = entries.length; i < l; ++i) {
            const entry = entries[i][1];
            if (entry instanceof SharedFunctionCodeEntry && !entry.used) {
                this.codeMap_.deleteCode(entries[i][0]);
            }
        }
    }

    private fixMissingSamples() {
        // source: chrome dev tools

        // Sometimes sampler is not able to parse the JS stack and returns
        // a (program) sample instead. The issue leads to call frames belong
        // to the same function invocation being split apart.
        // Here's a workaround for that. When there's a single (program) sample
        // between two call stacks sharing the same bottom node, it is replaced
        // with the preceeding sample.

        const samples = this.samples_;
        const samplesCount = samples.length;
        if (samplesCount < 3) return;
        let prevNode = samples[0].node;
        let prevLine = samples[0].line;
        let node = samples[1].node;
        let line = samples[1].line;
        for (let sampleIndex = 1; sampleIndex < samplesCount - 1; sampleIndex++) {
            const nextNode = samples[sampleIndex + 1].node;
            const nextLine = samples[sampleIndex + 1].line;
            if (node.entry === CodeEntry.program_entry() &&
                !isSystemNode(prevNode) &&
                !isSystemNode(nextNode) &&
                bottomNode(prevNode) === bottomNode(nextNode)) {
                samples[sampleIndex].node = prevNode;
                samples[sampleIndex].line = prevLine;
                samples[sampleIndex].node.selfWeight++;
                samples[sampleIndex].node.totalWeight++;
            }
            prevNode = node;
            prevLine = line;
            node = nextNode;
            line = nextLine;
        }
        function bottomNode(node: CallTreeNode): CallTreeNode {
            while (node.parent?.parent) {
                node = node.parent;
            }
            return node;
        }
        function isSystemNode(node: CallTreeNode): boolean {
            return node.entry === CodeEntry.program_entry() ||
                node.entry === CodeEntry.gc_entry() ||
                node.entry === CodeEntry.idle_entry();
        }
    }

    getScripts(): Script[] {
        this.throwIfNotFinalized_();
        return [...this.sources_.scripts()];
    }

    getJSONProfile(): JsonProfile {
        this.throwIfNotFinalized_();
        const nodes: JsonProfileNode[] = [];
        flattenJsonProfileNodes(this.topDownTree_.getRoot(), nodes);

        const samples: number[] = [];
        const timeDeltas: number[] = [];

        let lastTime = this.startTime.sinceOrigin().inMicroseconds();
        for (const sample of this.samples_) {
            samples.push(sample.node.id);

            const ts = sample.timestamp.sinceOrigin().inMicroseconds();
            timeDeltas.push(Number(ts - lastTime))
            lastTime = ts;
        }

        return {
            startTime: this.startTime.sinceOrigin().inMicrosecondsF(),
            endTime: this.endTime.sinceOrigin().inMicrosecondsF(),
            nodes,
            samples,
            timeDeltas
        };
    }
}

function flattenJsonProfileNodes(node: CallTreeNode, nodes: JsonProfileNode[]) {
    nodes.push(buildJsonProfileNode(node));
    for (const child of node.childNodes()) {
        flattenJsonProfileNodes(child, nodes);
    }
}

function buildJsonProfileNode(node: CallTreeNode): JsonProfileNode {
    const callFrame: JsonProfileCallFrame = {
        functionName: node.entry.getName(),
        scriptId: `${node.entry.script?.scriptId ?? kNoScriptInfo}`,
        url: formatUri(node.entry.filePosition?.uri, { as: "file" }),
        lineNumber: node.entry.filePosition?.range.start.line ?? 0,
        columnNumber: node.entry.filePosition?.range.start.character ?? 0,
    };

    const profileNode: JsonProfileNode = {
        callFrame,
        hitCount: node.selfWeight,
        id: node.id
    };

    let children: number[] | undefined;
    for (const child of node.childNodes()) {
        children ??= [];
        children.push(child.id);
    }

    if (children) {
        profileNode.children = children;
    }

    const bailout_reason = node.entry.bailout_reason;
    if (bailout_reason && bailout_reason !== "no reason") {
        profileNode.deoptReason = bailout_reason;
    }

    const positionTicks = buildJsonProfilePositionTicks(node);
    if (positionTicks) {
        profileNode.positionTicks = positionTicks;
    }

    return profileNode;
}

function buildJsonProfilePositionTicks(node: CallTreeNode): JsonProfilePositionTickInfo[] | undefined {
    const lineTicks = node.getLineTicks();
    if (lineTicks.length === 0) return undefined;
    return lineTicks.map(({ line, hitCount: hit_count }) => ({ line, ticks: hit_count }))
}
