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

// TODO(rbuckton): This may have been replaced by logEventsAndTags.ts

// https://github.com/v8/v8/blob/0aacfb2a6ecbeda1d1d97ca113afd8253a1b9670/include/v8-profiler.h#L1027
export const enum CodeEventType {
    Unknown,
    Builtin,
    Callback,
    Eval,
    Function,
    InterpretedFunction,
    Handler,
    BytecodeHandler,
    LazyCompile,
    RegExp,
    Script,
    Stub,
    Relocation,
}

// TODO: Check for version-related differences

const enumVersions = new VersionedEnum<CodeEventType>("CodeEventType", {
    "*": [
        // https://github.com/v8/v8/blob/0aacfb2a6ecbeda1d1d97ca113afd8253a1b9670/include/v8-profiler.h#L1027
        [CodeEventType.Unknown, "Unknown"],
        [CodeEventType.Builtin, "Builtin"],
        [CodeEventType.Callback, "Callback"],
        [CodeEventType.Eval, "Eval"],
        [CodeEventType.Function, "Function"],
        [CodeEventType.InterpretedFunction, "InterpretedFunction"],
        [CodeEventType.Handler, "Handler"],
        [CodeEventType.BytecodeHandler, "BytecodeHandler"],
        [CodeEventType.LazyCompile, "LazyCompile"],
        [CodeEventType.RegExp, "RegExp"],
        [CodeEventType.Script, "Script"],
        [CodeEventType.Stub, "Stub"],
        [CodeEventType.Relocation, "Relocation"],
    ]
});

/**
 * Gets a {@link CodeEventType} value derived from the legacy numeric value of a code event for a specific version of V8.
 * @param value The legacy code event value.
 * @param version The version of V8 for the legacy code event value.
 * @returns A normalized {@link CodeEventType} value.
 */
export function getCodeEventType(value: number, version = V8Version.MAX) {
    return enumVersions.toEnum(value, version);
}

/**
 * Parses a {@link CodeEventType} value derived from the legacy string name of a code event for a specific version of V8.
 * @param value The legacy code event string name.
 * @param version The version of V8 for the legacy code event string name.
 * @returns A normalized {@link CodeEventType} value.
 */
export function parseCodeEventType(value: string, version = V8Version.MAX) {
    return enumVersions.parseEnum(value, version);
}

/**
 * Formats a normalized {@link CodeEventType} value using the legacy string name for the value at the time of a specific version of V8.
 * @param value The normalized {@link CodeEventType} value.
 * @param version The version of V8 to use to format the code event.
 * @returns A string value for the {@link CodeEventType}.
 */
export function formatCodeEventType(value: CodeEventType, version = V8Version.MAX) {
    return enumVersions.formatEnum(value, version);
}
