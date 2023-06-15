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

import { Address, toAddress } from "#core/address.js";
import { assert } from "#core/assert.js";
import { kNullAddress } from "./constants";
import { SourcePosition } from "./sourcePosition";

const sourcePositionRegExp = /C(?<code_offset>\d+)O(?<script_offset>\d+)(?:I(?<inlining_id>\d+))?/y;

export class SourcePositionTableEntry {
    constructor(
        public codeOffset: Address,
        public sourcePosition: SourcePosition
    ) {
        assert(codeOffset >= kNullAddress);
    }
}

export function* sourcePositionTableIterator(sourcePositions: string): Generator<SourcePositionTableEntry, void> {
    //   <pos> is source position table encoded in the string,
    //      it is a sequence of C<code-offset>O<script-offset>[I<inlining-id>]
    //      where
    //        <code-offset> is the offset within the code object
    //        <script-offset> is the position within the script
    //        <inlining-id> is the offset in the <inlining> table
    sourcePositionRegExp.lastIndex = 0;
    let match: RegExpExecArray | null;
    while (match = sourcePositionRegExp.exec(sourcePositions)) {
        assert(match.groups);
        const code_offset = toAddress(parseInt(match.groups.code_offset, 10));
        const script_offset = parseInt(match.groups.script_offset, 10);
        const inlining_id = match.groups.inlining_id ? parseInt(match.groups.inlining_id, 10) : undefined;
        const source_position = new SourcePosition(script_offset, inlining_id);
        yield new SourcePositionTableEntry(code_offset, source_position);
    }
}
