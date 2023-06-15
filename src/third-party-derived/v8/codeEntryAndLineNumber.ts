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

import { Equaler, Equatable } from "@esfx/equatable";
import { assert } from "#core/assert.js";
import { CodeEntry } from "./tools/codeentry.js";

export class CodeEntryAndLineNumber {
    constructor(
        public code_entry: CodeEntry,
        public line_number: number
    ) {
        assert(line_number >= 0);
    }

    equals(other: CodeEntryAndLineNumber) {
        return Equaler.defaultEqualer.equals(this.code_entry, other.code_entry)
            && this.line_number === other.line_number;
    }

    hash() {
        let hash = 0;
        hash = Equaler.combineHashes(hash, Equaler.defaultEqualer.hash(this.code_entry));
        hash = Equaler.combineHashes(hash, Equaler.defaultEqualer.hash(this.line_number));
        return hash;
    }

    [Equatable.equals](other: unknown) {
        return other instanceof CodeEntryAndLineNumber && this.equals(other);
    }

    [Equatable.hash]() {
        return this.hash();
    }
}