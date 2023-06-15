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

import { V8Version } from "#core/v8Version.js";
import { VersionedEnum } from "#core/versionedEnum.js";

export const enum VmState {
    ScriptExecution = 0, // JS
    GarbageCollector = 1, // GC
    Parser = 2,
    BytecodeCompiler = 3,
    Compiler = 4,
    Other = 5,
    External = 6,
    AtomicsWait = 7, // Added in 8.2.1
    Idle = 8
}

const enumVersions = new VersionedEnum<VmState>("VmState", {
    // 8.2.1:
    // https://github.com/v8/v8/blob/6bbf2dfa5b3bde9a40527268741b739f7d7e4bd0/include/v8.h#L2388
    // added ATOMICS_WAIT
    ">=8.2.1": [
        VmState.ScriptExecution,
        VmState.GarbageCollector,
        VmState.Parser,
        VmState.BytecodeCompiler,
        VmState.Compiler,
        VmState.Other,
        VmState.External,
        VmState.AtomicsWait,
        VmState.Idle,
    ],

    // Any older versions and we just use these
    "*": [
        VmState.ScriptExecution,
        VmState.GarbageCollector,
        VmState.Parser,
        VmState.BytecodeCompiler,
        VmState.Compiler,
        VmState.Other,
        VmState.External,
        VmState.Idle,
    ]
});

export function getVmState(value: number, version = V8Version.MAX) {
    return enumVersions.toEnum(value, version);
}

export function parseVmState(value: string, version = V8Version.MAX) {
    return enumVersions.parseEnum(value, version);
}

export function formatVmState(state: VmState, version = V8Version.MAX) {
    return enumVersions.formatEnum(state, version);
}
