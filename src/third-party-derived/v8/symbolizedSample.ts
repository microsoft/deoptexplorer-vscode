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

import { ProfileStackTrace } from "./profileStackTrace";

export class SymbolizedSample {
    constructor(
        public stack_trace: ProfileStackTrace,
        public src_line: number,
    ) {
    }
}
