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

import { TimeTicks } from "#core/time.js";

/**
 * Represents a deoptimization event in a V8 execution timeline.
 */
export class DeoptEvent {
    constructor(
        readonly timestamp: TimeTicks,
        readonly size: number
    ) { }
}