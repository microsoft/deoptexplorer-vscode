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

import { assert } from "#core/assert.js";
import { kNoSourcePosition, kNotInlined } from "./constants";
import { DeoptimizationData } from "./deoptimizationData";
import { SourcePositionInfo } from "./sourcePositionInfo";

// https://github.com/v8/v8/blob/84f3877c15bc7f8956d21614da4311337525a3c8/src/codegen/source-position.h#L45
export class SourcePosition {
    private _scriptOffset: number;
    private _inliningId: number;
    private _isExternal: boolean;
    private _externalLine: number = 0;
    private _externalFileId: number = 0;

    constructor(
        script_offset: number,
        inlining_id = kNotInlined
    ) {
        assert(script_offset >= 0);
        assert(inlining_id >= kNotInlined);
        this._isExternal = false;
        this._scriptOffset = script_offset;
        this._inliningId = inlining_id;
    }

    get isKnown() {
        if (this.isExternal) return true;
        return this.scriptOffset !== kNoSourcePosition
            || this.inliningId !== kNotInlined;
    }

    get isInlined() {
        if (this.isExternal) return false;
        return this.inliningId !== kNotInlined;
    }

    get isExternal() {
        return this._isExternal;
    }

    set isExternal(value: boolean) {
        this._isExternal = value;
    }

    get isJavaScript() {
        return !this.isExternal;
    }

    get externalLine() {
        assert(this.isExternal);
        return this._externalLine;
    }

    set externalLine(value: number) {
        assert(this.isExternal);
        assert(value >= 0 && value < (1 << 20));
        this._externalLine = value;
    }

    get externalFileId() {
        assert(this.isExternal);
        return this._externalFileId;
    }

    set externalFileId(value: number) {
        assert(this.isExternal);
        assert(value >= 0 && value < (1 << 10));
        this._externalFileId = value;
    }

    get scriptOffset() {
        assert(this.isJavaScript);
        return this._scriptOffset;
    }

    set scriptOffset(value: number) {
        assert(this.isJavaScript);
        assert(value >= kNoSourcePosition && value < ((1 << 30) - 1));
        this._scriptOffset = value;
    }

    get inliningId() {
        return this._inliningId;
    }

    set inliningId(value: number) {
        assert(value >= kNotInlined && value < ((1 << 16) - 1));
        this._inliningId = value;
    }

    static external(line: number, file_id: number) {
        const pos = new SourcePosition(kNoSourcePosition);
        pos.isExternal = true;
        pos.externalLine = line;
        pos.externalFileId = file_id;
        pos.inliningId = kNotInlined;
        return pos;
    }

    static unknown() {
        return new SourcePosition(kNoSourcePosition);
    }

    // https://github.com/v8/v8/blob/a0c3797461810e3159662851e64946e17654236e/src/codegen/source-position.cc#L62
    inliningStack(deopt_data: DeoptimizationData) {
        let stack: SourcePositionInfo[] = [];
        let pos: SourcePosition = this;
        while (pos.isInlined) {
            assert(pos.inliningId < deopt_data.inliningPositions.length);
            let inl = deopt_data.inliningPositions[pos.inliningId];
            let func = deopt_data.getInlinedFunction(inl.inlinedFunctionId);
            stack.push(new SourcePositionInfo(pos, func, func.script));
            pos = inl.position;
        }
        stack.push(new SourcePositionInfo(pos, deopt_data.shared, deopt_data.shared.script));
        return stack;
    }
}