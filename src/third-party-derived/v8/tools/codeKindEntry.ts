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

import { CodeKind } from "../enums/codeKind";
import { FunctionEntry } from "../../deoptigate/functionEntry";
import { TimeTicks } from "../../../core/time";

/**
 * Represents an code event in a V8 execution timeline.
 */
export class CodeKindEvent {
    constructor(
        readonly timestamp: TimeTicks,
        readonly func?: FunctionEntry
    ) { }

    get title() {
        return this.func ? `${this.func.functionName} ${this.func.filePosition}` : "";
    }
}

/**
 * Represents a code kind displayed in a V8 execution timeline.
 */
export class CodeKindEntry {
    static readonly STACK_FRAMES = 8;

    readonly inExecution: CodeKindEvent[] = [];
    readonly stackFrames: CodeKindEvent[][] = [];

    constructor(
        readonly color: string,
        readonly kinds: CodeKind[]
    ) {
        for (let i = 0; i < CodeKindEntry.STACK_FRAMES; i++) {
            this.stackFrames[i] = [];
        }
    }
}