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
import { kNotInlined } from "./constants";
import { SourcePosition } from "./sourcePosition";

export class InliningPosition {
    constructor(
        public position: SourcePosition,
        public inlinedFunctionId: number,
    ) {
        assert(inlinedFunctionId >= kNotInlined);
    }
}
