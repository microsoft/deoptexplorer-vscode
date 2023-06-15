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

import { Comparer } from "@esfx/equatable";
import { Address } from "#core/address.js";
import { assert } from "#core/assert.js";
import { binarySearchKey } from "#core/utils.js";
import { kNoLineNumberInfo, kNotInlined, kNullAddress } from "./constants";

class SourcePositionTuple {
    constructor(
        public pcOffset: Address,
        public lineNumber: number, // TODO: Check if this is 0-based or 1-based
        public inliningId: number
    ) {
    }
}

export class SourcePositionTable {
    private _pcOffsetsToLines_: SourcePositionTuple[] = [];

    // https://github.com/v8/v8/blob/6bbf2dfa5b3bde9a40527268741b739f7d7e4bd0/src/profiler/profile-generator.cc#L22
    setPosition(pcOffset: Address, line: number, inliningId: number) {
        assert(pcOffset >= kNullAddress);
        assert(line > 0); // The 1-based number of the source line.
        assert(inliningId >= kNotInlined);
        // It's possible that we map multiple source positions to a pc_offset in
        // optimized code. Usually these map to the same line, so there is no
        // difference here as we only store line number and not line/col in the form
        // of a script offset. Ignore any subsequent sets to the same offset.
        const element = this._pcOffsetsToLines_.length ? this._pcOffsetsToLines_[this._pcOffsetsToLines_.length - 1] : undefined;
        if (element?.pcOffset === pcOffset) {
            return;
        }

        // Check that we are inserting in ascending order, so that the vector remains
        // sorted.
        assert(!element || element.pcOffset < pcOffset);
        if (!element ||
            element.lineNumber !== line ||
            element.inliningId !== inliningId) {
            this._pcOffsetsToLines_.push(new SourcePositionTuple(pcOffset, line, inliningId));
        }
    }

    // https://github.com/v8/v8/blob/6bbf2dfa5b3bde9a40527268741b739f7d7e4bd0/src/profiler/profile-generator.cc#L45
    getSourceLineNumber(pcOffset: Address): number {
        assert(pcOffset >= 0);
        if (!this._pcOffsetsToLines_.length) return kNoLineNumberInfo;
        let i = binarySearchKey(this._pcOffsetsToLines_, pcOffset, _ => _.pcOffset, Comparer.defaultComparer);
        if (i < 0) i = ~i;
        if (i > 0) i--;
        assert(i >= 0 && i < this._pcOffsetsToLines_.length);
        return this._pcOffsetsToLines_[i].lineNumber;
    }

    // https://github.com/v8/v8/blob/6bbf2dfa5b3bde9a40527268741b739f7d7e4bd0/src/profiler/profile-generator.cc#L56
    getInliningId(pcOffset: Address): number {
        assert(pcOffset >= 0);
        if (!this._pcOffsetsToLines_.length) return kNotInlined;
        let i = binarySearchKey(this._pcOffsetsToLines_, pcOffset, _ => _.pcOffset, Comparer.defaultComparer);
        if (i < 0) i = ~i;
        if (i > 0) i--;
        assert(i >= 0 && i < this._pcOffsetsToLines_.length);
        return this._pcOffsetsToLines_[i].inliningId;
    }
}