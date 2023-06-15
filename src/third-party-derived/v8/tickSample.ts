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

import { Address } from "#core/address.js";
import { assert } from "#core/assert.js";
import { TimeTicks } from "#core/time.js";
import { kNullAddress } from "./constants";
import { VmState } from "./enums/vmState";

// https://github.com/v8/v8/blob/6bbf2dfa5b3bde9a40527268741b739f7d7e4bd0/src/profiler/tick-sample.h
export class TickSample {
    constructor(
        /** Program counter (address of function execution) */
        readonly pc: Address,
        readonly timestamp: TimeTicks,
        readonly has_external_callback: boolean,
        private tosOrExternalCallbackEntry: Address,
        readonly state: VmState,
        readonly stack: readonly Address[],
    ) {
        assert(pc >= kNullAddress);
        assert(tosOrExternalCallbackEntry >= kNullAddress);
    }

    get external_callback_entry() {
        assert(this.has_external_callback);
        return this.tosOrExternalCallbackEntry;
    }

    get tos() {
        assert(!this.has_external_callback);
        return this.tosOrExternalCallbackEntry;
    }

    get frame_count() {
        return this.stack.length;
    }
}