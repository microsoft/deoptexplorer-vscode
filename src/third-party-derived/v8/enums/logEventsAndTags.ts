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

// https://github.com/v8/v8/blob/5ecb5bd9785ae9713089826db8f8ab4f5b68172e/src/logging/log.cc#L57
export const enum LogEventsAndTags {
    // https://github.com/v8/v8/blob/0aacfb2a6ecbeda1d1d97ca113afd8253a1b9670/src/logging/code-events.h#L32
    // from LOG_EVENTS_LIST
    CODE_CREATION_EVENT,
    CODE_DISABLE_OPT_EVENT,
    CODE_MOVE_EVENT,
    CODE_DELETE_EVENT,
    CODE_MOVING_GC,
    SHARED_FUNC_MOVE_EVENT,
    SNAPSHOT_CODE_NAME_EVENT,
    TICK_EVENT,

    // https://github.com/v8/v8/blob/0aacfb2a6ecbeda1d1d97ca113afd8253a1b9670/src/logging/code-events.h#L43
    // from TAGS_LIST
    BUILTIN_TAG,
    CALLBACK_TAG,
    EVAL_TAG,
    FUNCTION_TAG,
    HANDLER_TAG,
    BYTECODE_HANDLER_TAG,
    LAZY_COMPILE_TAG,
    REG_EXP_TAG,
    SCRIPT_TAG,
    STUB_TAG,
    NATIVE_FUNCTION_TAG,
    NATIVE_LAZY_COMPILE_TAG,
    NATIVE_SCRIPT_TAG,
}

const enumVersions = new VersionedEnum<LogEventsAndTags>("LogEventsAndTags", {
    "*": [
        // https://github.com/v8/v8/blob/0aacfb2a6ecbeda1d1d97ca113afd8253a1b9670/src/logging/code-events.h#L32
        // from LOG_EVENTS_LIST
        [LogEventsAndTags.CODE_CREATION_EVENT, "code-creation"],
        [LogEventsAndTags.CODE_DISABLE_OPT_EVENT, "code-disable-optimization"],
        [LogEventsAndTags.CODE_MOVE_EVENT, "code-move"],
        [LogEventsAndTags.CODE_DELETE_EVENT, "code-delete"],
        [LogEventsAndTags.CODE_MOVING_GC, "code-moving-gc"],
        [LogEventsAndTags.SHARED_FUNC_MOVE_EVENT, "sfi-move"],
        [LogEventsAndTags.SNAPSHOT_CODE_NAME_EVENT, "snapshot-code-name"],
        [LogEventsAndTags.TICK_EVENT, "tick"],

        // https://github.com/v8/v8/blob/0aacfb2a6ecbeda1d1d97ca113afd8253a1b9670/src/logging/code-events.h#L43
        // from TAGS_LIST
        [LogEventsAndTags.BUILTIN_TAG, "Builtin"],
        [LogEventsAndTags.CALLBACK_TAG, "Callback"],
        [LogEventsAndTags.EVAL_TAG, "Eval"],
        [LogEventsAndTags.FUNCTION_TAG, "Function"],
        [LogEventsAndTags.HANDLER_TAG, "Handler"],
        [LogEventsAndTags.BYTECODE_HANDLER_TAG, "BytecodeHandler"],
        [LogEventsAndTags.LAZY_COMPILE_TAG, "LazyCompile"],
        [LogEventsAndTags.REG_EXP_TAG, "RegExp"],
        [LogEventsAndTags.SCRIPT_TAG, "Script"],
        [LogEventsAndTags.STUB_TAG, "Stub"],
        [LogEventsAndTags.NATIVE_FUNCTION_TAG, "Function"],
        [LogEventsAndTags.NATIVE_LAZY_COMPILE_TAG, "LazyCompile"],
        [LogEventsAndTags.NATIVE_SCRIPT_TAG, "Script"],
    ]
});

export function getLogEventsAndTags(value: number, version = V8Version.MAX) {
    return enumVersions.toEnum(value, version);
}

export function formatLogEventsAndTags(value: LogEventsAndTags, version = V8Version.MAX) {
    return enumVersions.formatEnum(value, version);
}

export function parseLogEventsAndTags(value: string, version = V8Version.MAX) {
    return enumVersions.parseEnum(value, version);
}
