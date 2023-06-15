// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
//
// THIRD PARTY LICENSE NOTICE:
//
// Portions of this code are sourced from V8:
//
//  Copyright 2012 the V8 project authors. All rights reserved.
//  Use of this source code is governed by a BSD-style license that can be
//  found in the LICENSE.v8 file.

import { parseAddress } from "#core/address.js";
import { assert } from "#core/assert.js";
import { kNotInlined } from "./constants";
import { InliningPosition } from "./inliningPosition";
import { SourcePosition } from "./sourcePosition";
import { SharedFunctionCodeEntry } from "./tools/codeentry";
import { CodeMap } from "./tools/codemap";

const inliningPositionRegExp = /F(?<function_id>\d+)?O(?<script_offset>\d+)(?:I(?<inlining_id>\d+))?/y;
const inlinedFunctionsRegExp = /S(?<address>0[xX][0-9a-fA-F]+)/y;

/**
 * Represents deoptimization data parsed from a v8 log file.
 */
export class DeoptimizationData {
    constructor(
        public inliningPositions: InliningPosition[],
        public inlinedFunctions: SharedFunctionCodeEntry[],
        public shared: SharedFunctionCodeEntry,
    ) {
        assert(!inliningPositions.some(pos => pos.inlinedFunctionId < kNotInlined || pos.inlinedFunctionId >= inlinedFunctions.length));
    }

    getInlinedFunction(index: number) {
        assert(index >= kNotInlined && index < this.inlinedFunctions.length, "Index out of range");
        return index === kNotInlined ? this.shared : this.inlinedFunctions[index];
    }

    static deserialize(inliningPositions: string, inlinedFunctions: string, codeMap: CodeMap, shared: SharedFunctionCodeEntry) {
        let match: RegExpExecArray | null;

        //   <inlining> table is a sequence of strings of the form
        //      F<function-id>O<script-offset>[I<inlining-id>]
        //      where
        //         <function-id> is an index into the <fns> function table
        const inliningPositionsArray: InliningPosition[] = [];
        inliningPositionRegExp.lastIndex = 0;
        while (match = inliningPositionRegExp.exec(inliningPositions)) {
            assert(match.groups);
            const inlined_function_id = match.groups.function_id ? parseInt(match.groups.function_id, 10) : -1;
            const script_offset = parseInt(match.groups.script_offset, 10);
            const inlining_id = match.groups.inlining_id ? parseInt(match.groups.inlining_id, 10) : kNotInlined;
            const position = new SourcePosition(script_offset, inlining_id);
            inliningPositionsArray.push(new InliningPosition(position, inlined_function_id));
        }

        //   <fns> is the function table encoded as a sequence of strings
        //      S<shared-function-info-address>
        const inlinedFunctionsArray: SharedFunctionCodeEntry[] = [];
        inlinedFunctionsRegExp.lastIndex = 0;
        while (match = inlinedFunctionsRegExp.exec(inlinedFunctions)) {
            assert(match.groups);
            const address = parseAddress(match.groups.address);
            const entry = codeMap.findEntry(address);
            // if (entry?.type === "SHARED_LIB" && entry.name.includes("node.exe")) {
            //     debugger;
            // }
            let sharedEntry = entry instanceof SharedFunctionCodeEntry ? entry : undefined;
            if (!sharedEntry) {
                sharedEntry = SharedFunctionCodeEntry.unresolved_entry();
                codeMap.addCode(address, sharedEntry);
            }
            inlinedFunctionsArray.push(sharedEntry);
        }

        return new DeoptimizationData(
            inliningPositionsArray,
            inlinedFunctionsArray,
            shared
        );
    }
}