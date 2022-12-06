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

import { V8Version } from "../../../core/v8Version";
import { VersionedEnum } from "../../../core/versionedEnum";

export const enum CodeKind {
    // Current as of 6bbf2dfa5b3bde9a40527268741b739f7d7e4bd0 (last changed in 9.2.42)
    BYTECODE_HANDLER,
    FOR_TESTING,
    BUILTIN,
    REGEXP,
    WASM_FUNCTION,
    WASM_TO_CAPI_FUNCTION,
    WASM_TO_JS_FUNCTION,
    JS_TO_WASM_FUNCTION,
    JS_TO_JS_FUNCTION,
    C_WASM_ENTRY,
    INTERPRETED_FUNCTION,
    BASELINE,
    TURBOPROP,
    TURBOFAN,

    // Older
    /** @deprecated since 9.2.42 */
    NATIVE_CONTEXT_INDEPENDENT,
    /** @deprecated since 8.7.237 */
    OPTIMIZED_FUNCTION,
    /** @deprecated since 8.7.237 */
    STUB,
    /** @deprecated since 8.4.309 */
    WASM_INTERPRETER_ENTRY,
    /** @deprecated since 6.3.229 */
    HANDLER,
    /** @deprecated since 6.3.224 */
    LOAD_IC,
    /** @deprecated since 6.3.224 */
    LOAD_GLOBAL_IC,
    /** @deprecated since 6.3.224 */
    KEYED_LOAD_IC,
    /** @deprecated since 6.3.224 */
    STORE_IC,
    /** @deprecated since 6.3.224 */
    STORE_GLOBAL_IC,
    /** @deprecated since 6.3.224 */
    KEYED_STORE_IC,
    /** @deprecated since 6.3.104 */
    FUNCTION,
}

const enumVersions = new VersionedEnum("CodeKind", {
    // 9.2.42:
    // https://github.com/v8/v8/commit/5ecb5bd9785ae9713089826db8f8ab4f5b68172e#diff-ee89eb810fe70631905ac9eeb62ec4c603db4e46f4aab222e998dca3485c0d79L31
    // removed NATIVE_CONTEXT_INDEPENDENT
    ">=9.2.42": [
        CodeKind.BYTECODE_HANDLER,
        CodeKind.FOR_TESTING,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.WASM_FUNCTION,
        CodeKind.WASM_TO_CAPI_FUNCTION,
        CodeKind.WASM_TO_JS_FUNCTION,
        CodeKind.JS_TO_WASM_FUNCTION,
        CodeKind.JS_TO_JS_FUNCTION,
        CodeKind.C_WASM_ENTRY,
        CodeKind.INTERPRETED_FUNCTION,
        CodeKind.BASELINE,
        CodeKind.TURBOPROP,
        CodeKind.TURBOFAN,
    ],

    // 9.0.240:
    // https://github.com/v8/v8/commit/9070b2cb86f1d462f9cd71b756ffdf063442e46a#diff-ee89eb810fe70631905ac9eeb62ec4c603db4e46f4aab222e998dca3485c0d79R31
    // moved NATIVE_CONTEXT_INDEPENDENT after BASELINE
    ">=9.0.240": [
        CodeKind.BYTECODE_HANDLER,
        CodeKind.FOR_TESTING,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.WASM_FUNCTION,
        CodeKind.WASM_TO_CAPI_FUNCTION,
        CodeKind.WASM_TO_JS_FUNCTION,
        CodeKind.JS_TO_WASM_FUNCTION,
        CodeKind.JS_TO_JS_FUNCTION,
        CodeKind.C_WASM_ENTRY,
        CodeKind.INTERPRETED_FUNCTION,
        CodeKind.BASELINE,
        CodeKind.NATIVE_CONTEXT_INDEPENDENT,
        CodeKind.TURBOPROP,
        CodeKind.TURBOFAN,
    ],

    // 9.0.170:
    // https://github.com/v8/v8/commit/c913ef3a915aeccfcdbf37edbba0d3f926c0a1f5#diff-ee89eb810fe70631905ac9eeb62ec4c603db4e46f4aab222e998dca3485c0d79R30
    // renamed SPARKPLUG to BASELINE
    //
    // 9.0.168:
    // https://github.com/v8/v8/commit/c053419e8ca5fb983cb60d6c32b111bdf92d646f#diff-ee89eb810fe70631905ac9eeb62ec4c603db4e46f4aab222e998dca3485c0d79
    // Added SPARKPLUG
    ">=9.0.168": [
        CodeKind.BYTECODE_HANDLER,
        CodeKind.FOR_TESTING,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.WASM_FUNCTION,
        CodeKind.WASM_TO_CAPI_FUNCTION,
        CodeKind.WASM_TO_JS_FUNCTION,
        CodeKind.JS_TO_WASM_FUNCTION,
        CodeKind.JS_TO_JS_FUNCTION,
        CodeKind.C_WASM_ENTRY,
        CodeKind.INTERPRETED_FUNCTION,
        CodeKind.NATIVE_CONTEXT_INDEPENDENT,
        CodeKind.BASELINE,
        CodeKind.TURBOPROP,
        CodeKind.TURBOFAN,
    ],

    // 8.8.241:
    // https://github.com/v8/v8/commit/b022c448d8ee01209676dd6773112b65455f743f#diff-ee89eb810fe70631905ac9eeb62ec4c603db4e46f4aab222e998dca3485c0d79R30
    // moved TURBOFAN to bottom
    ">=8.8.241": [
        CodeKind.BYTECODE_HANDLER,
        CodeKind.FOR_TESTING,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.WASM_FUNCTION,
        CodeKind.WASM_TO_CAPI_FUNCTION,
        CodeKind.WASM_TO_JS_FUNCTION,
        CodeKind.JS_TO_WASM_FUNCTION,
        CodeKind.JS_TO_JS_FUNCTION,
        CodeKind.C_WASM_ENTRY,
        CodeKind.INTERPRETED_FUNCTION,
        CodeKind.NATIVE_CONTEXT_INDEPENDENT,
        CodeKind.TURBOPROP,
        CodeKind.TURBOFAN,
    ],

    // 8.8.149:
    // https://github.com/v8/v8/commit/c7cb9beca18d98ba83c3b75860b912219d425d0e?w=1#diff-ee89eb810fe70631905ac9eeb62ec4c603db4e46f4aab222e998dca3485c0d79R17
    // renamed DEOPT_ENTRIES_OR_FOR_TESTING to FOR_TESTING
    // (relanded change in 8.8.123)
    //
    // 8.8.141:
    // https://github.com/v8/v8/commit/c7cb9beca18d98ba83c3b75860b912219d425d0e?w=1#diff-ee89eb810fe70631905ac9eeb62ec4c603db4e46f4aab222e998dca3485c0d79R17
    // renamed DEOPT_ENTRIES_OR_FOR_TESTING to FOR_TESTING
    // and then renamed FOR_TESTING back to DEOPT_ENTRIES_OR_FOR_TESTING
    // (relanded change from 8.8.123, and then reverted again)
    //
    // 8.8.138:
    // https://github.com/v8/v8/commit/8bc9a7941cd44a43d062975304d56caba9f04e04?w=1#diff-ee89eb810fe70631905ac9eeb62ec4c603db4e46f4aab222e998dca3485c0d79R19
    // renamed FOR_TESTING back to DEOPT_ENTRIES_OR_FOR_TESTING
    // (reverted change in 8.8.123)
    //
    // 8.8.123:
    // https://github.com/v8/v8/commit/7f58ced72eb65b6b5530ccabaf2eaebe45bf9d33?w=1#diff-ee89eb810fe70631905ac9eeb62ec4c603db4e46f4aab222e998dca3485c0d79R17
    // renamed DEOPT_ENTRIES_OR_FOR_TESTING to FOR_TESTING
    //
    // 8.7.237:
    // https://github.com/v8/v8/commit/29bcdaad1d68a3961fa6535eadac901907c768e6?w=1#diff-ee89eb810fe70631905ac9eeb62ec4c603db4e46f4aab222e998dca3485c0d79R17
    // replaced OPTIMIZED_FUNCTION with TURBOFAN
    // replaced STUB with DEOPT_ENTRIES_OR_FOR_TESTING
    ">=8.7.237": [
        CodeKind.TURBOFAN,
        CodeKind.BYTECODE_HANDLER,
        CodeKind.FOR_TESTING,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.WASM_FUNCTION,
        CodeKind.WASM_TO_CAPI_FUNCTION,
        CodeKind.WASM_TO_JS_FUNCTION,
        CodeKind.JS_TO_WASM_FUNCTION,
        CodeKind.JS_TO_JS_FUNCTION,
        CodeKind.C_WASM_ENTRY,
        CodeKind.INTERPRETED_FUNCTION,
        CodeKind.NATIVE_CONTEXT_INDEPENDENT,
        CodeKind.TURBOPROP,
    ],

    // 8.7.227:
    // https://github.com/v8/v8/commit/75b8c238dccf2be34e2f67dd4c71e30b8e03e9c2?w=1#diff-ee89eb810fe70631905ac9eeb62ec4c603db4e46f4aab222e998dca3485c0d79R32
    // added TURBOPROP
    ">=8.7.227": [
        CodeKind.OPTIMIZED_FUNCTION,
        CodeKind.BYTECODE_HANDLER,
        CodeKind.STUB,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.WASM_FUNCTION,
        CodeKind.WASM_TO_CAPI_FUNCTION,
        CodeKind.WASM_TO_JS_FUNCTION,
        CodeKind.JS_TO_WASM_FUNCTION,
        CodeKind.JS_TO_JS_FUNCTION,
        CodeKind.C_WASM_ENTRY,
        CodeKind.INTERPRETED_FUNCTION,
        CodeKind.NATIVE_CONTEXT_INDEPENDENT,
        CodeKind.TURBOPROP,
    ],

    // 8.6.336:
    // https://github.com/v8/v8/commit/c51041f45400928cd64fbc8f389c0dd0dd15f82f#diff-ee89eb810fe70631905ac9eeb62ec4c603db4e46f4aab222e998dca3485c0d79R17
    // moved to src/objects/code-kind.h from src/objects/code.h
    // added INTERPRETED_FUNCTION
    // added NATIVE_CONTEXT_INDEPENDENT
    ">=8.6.336": [
        CodeKind.OPTIMIZED_FUNCTION,
        CodeKind.BYTECODE_HANDLER,
        CodeKind.STUB,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.WASM_FUNCTION,
        CodeKind.WASM_TO_CAPI_FUNCTION,
        CodeKind.WASM_TO_JS_FUNCTION,
        CodeKind.JS_TO_WASM_FUNCTION,
        CodeKind.JS_TO_JS_FUNCTION,
        CodeKind.C_WASM_ENTRY,
        CodeKind.INTERPRETED_FUNCTION,
        CodeKind.NATIVE_CONTEXT_INDEPENDENT,
    ],

    // 8.4.309:
    // https://github.com/v8/v8/commit/2c45f607a2819c74d67ce6ee51027b1a79bea6d8#diff-b7815ddb3adf8e38bef3a021d2fd81e083d9800f8f5359d7ebc503b25ba916e5L50
    // removed WASM_INTERPRETER_ENTRY
    ">=8.4.309": [
        CodeKind.OPTIMIZED_FUNCTION,
        CodeKind.BYTECODE_HANDLER,
        CodeKind.STUB,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.WASM_FUNCTION,
        CodeKind.WASM_TO_CAPI_FUNCTION,
        CodeKind.WASM_TO_JS_FUNCTION,
        CodeKind.JS_TO_WASM_FUNCTION,
        CodeKind.JS_TO_JS_FUNCTION,
        CodeKind.C_WASM_ENTRY,
    ],

    // 7.8.5:
    // https://github.com/v8/v8/commit/ba77172be190a051c4634e1782f96caeb6af92b5#diff-b7815ddb3adf8e38bef3a021d2fd81e083d9800f8f5359d7ebc503b25ba916e5R48
    // added JS_TO_JS_FUNCTION
    ">=7.8.5": [
        CodeKind.OPTIMIZED_FUNCTION,
        CodeKind.BYTECODE_HANDLER,
        CodeKind.STUB,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.WASM_FUNCTION,
        CodeKind.WASM_TO_CAPI_FUNCTION,
        CodeKind.WASM_TO_JS_FUNCTION,
        CodeKind.JS_TO_WASM_FUNCTION,
        CodeKind.WASM_INTERPRETER_ENTRY,
        CodeKind.C_WASM_ENTRY,
    ],

    // 7.6.128:
    // https://github.com/v8/v8/commit/a58a937189fc256ed12ea89ee4338f9f535e63d8#diff-b7815ddb3adf8e38bef3a021d2fd81e083d9800f8f5359d7ebc503b25ba916e5R46
    // added WASM_TO_CAPI_FUNCTION
    ">=7.6.128": [
        CodeKind.OPTIMIZED_FUNCTION,
        CodeKind.BYTECODE_HANDLER,
        CodeKind.STUB,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.WASM_FUNCTION,
        CodeKind.WASM_TO_CAPI_FUNCTION,
        CodeKind.WASM_TO_JS_FUNCTION,
        CodeKind.JS_TO_WASM_FUNCTION,
        CodeKind.WASM_INTERPRETER_ENTRY,
        CodeKind.C_WASM_ENTRY,
    ],

    // 6.4.6:
    // https://github.com/v8/v8/commit/d953b2ab726acca0b3abe90ce090a16d7ccc2ae3#diff-b7815ddb3adf8e38bef3a021d2fd81e083d9800f8f5359d7ebc503b25ba916e5R109
    // moved from src/object.h to src/objects/code.h
    //
    // 6.3.229:
    // https://github.com/v8/v8/commit/8f06e08a21896ed0777f78fbaf34cca87dcd5314#diff-3a388106f384db09426fc3a25392bf0a1cc7ead81045ee62b40f94c3ee405a95L3649
    // removed HANDLER
    ">=6.3.229": [
        CodeKind.OPTIMIZED_FUNCTION,
        CodeKind.BYTECODE_HANDLER,
        CodeKind.STUB,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.WASM_FUNCTION,
        CodeKind.WASM_TO_JS_FUNCTION,
        CodeKind.JS_TO_WASM_FUNCTION,
        CodeKind.WASM_INTERPRETER_ENTRY,
        CodeKind.C_WASM_ENTRY,
    ],

    // 6.3.224:
    // https://github.com/v8/v8/commit/6e68a28bfcf#diff-3a388106f384db09426fc3a25392bf0a1cc7ead81045ee62b40f94c3ee405a95L3658
    // removed IC kinds
    ">=6.3.224": [
        CodeKind.OPTIMIZED_FUNCTION,
        CodeKind.BYTECODE_HANDLER,
        CodeKind.STUB,
        CodeKind.HANDLER,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.WASM_FUNCTION,
        CodeKind.WASM_TO_JS_FUNCTION,
        CodeKind.JS_TO_WASM_FUNCTION,
        CodeKind.WASM_INTERPRETER_ENTRY,
        CodeKind.C_WASM_ENTRY,
    ],

    // 6.3.104:
    // https://github.com/v8/v8/commit/8340a86a62dead9ecd38e4075303645b4d9ff021#diff-af0936115cfa3d20efe7b10baa7f183bL3652
    // removed FUNCTION
    ">=6.3.104": [
        CodeKind.OPTIMIZED_FUNCTION,
        CodeKind.BYTECODE_HANDLER,
        CodeKind.STUB,
        CodeKind.HANDLER,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.WASM_FUNCTION,
        CodeKind.WASM_TO_JS_FUNCTION,
        CodeKind.JS_TO_WASM_FUNCTION,
        CodeKind.WASM_INTERPRETER_ENTRY,
        CodeKind.C_WASM_ENTRY,
        CodeKind.LOAD_IC,
        CodeKind.LOAD_GLOBAL_IC,
        CodeKind.KEYED_LOAD_IC,
        CodeKind.STORE_IC,
        CodeKind.STORE_GLOBAL_IC,
        CodeKind.KEYED_STORE_IC,
    ],

    // 6.2.159:
    // https://github.com/v8/v8/commit/c39c6eba009599aef74920a3c0469d2ef18feec1#diff-af0936115cfa3d20efe7b10baa7f183bR3671
    // added C_WASM_ENTRY
    ">=6.2.159": [
        CodeKind.FUNCTION,
        CodeKind.OPTIMIZED_FUNCTION,
        CodeKind.BYTECODE_HANDLER,
        CodeKind.STUB,
        CodeKind.HANDLER,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.WASM_FUNCTION,
        CodeKind.WASM_TO_JS_FUNCTION,
        CodeKind.JS_TO_WASM_FUNCTION,
        CodeKind.WASM_INTERPRETER_ENTRY,
        CodeKind.C_WASM_ENTRY,
        CodeKind.LOAD_IC,
        CodeKind.LOAD_GLOBAL_IC,
        CodeKind.KEYED_LOAD_IC,
        CodeKind.STORE_IC,
        CodeKind.STORE_GLOBAL_IC,
        CodeKind.KEYED_STORE_IC,
    ],

    // 5.7.442:
    // https://github.com/v8/v8/commit/81700ddfdc579c54e03d4d26fc0331fc13f92aca#diff-af0936115cfa3d20efe7b10baa7f183bR5068
    // added WASM_INTERPRETER_ENTRY
    ">=5.7.442": [
        CodeKind.FUNCTION,
        CodeKind.OPTIMIZED_FUNCTION,
        CodeKind.BYTECODE_HANDLER,
        CodeKind.STUB,
        CodeKind.HANDLER,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.WASM_FUNCTION,
        CodeKind.WASM_TO_JS_FUNCTION,
        CodeKind.JS_TO_WASM_FUNCTION,
        CodeKind.WASM_INTERPRETER_ENTRY,
        CodeKind.LOAD_IC,
        CodeKind.LOAD_GLOBAL_IC,
        CodeKind.KEYED_LOAD_IC,
        CodeKind.STORE_IC,
        CodeKind.STORE_GLOBAL_IC,
        CodeKind.KEYED_STORE_IC,
    ],

    // 5.1.90:
    // https://github.com/v8/v8/commit/8447072d605f08f7b2c3f3415891648782d55c35#diff-af0936115cfa3d20efe7b10baa7f183bR4883
    // added BYTECODE_HANDLER
    ">=5.1.90": [
        CodeKind.FUNCTION,
        CodeKind.OPTIMIZED_FUNCTION,
        CodeKind.BYTECODE_HANDLER,
        CodeKind.STUB,
        CodeKind.HANDLER,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.WASM_FUNCTION,
        CodeKind.WASM_TO_JS_FUNCTION,
        CodeKind.JS_TO_WASM_FUNCTION,
        CodeKind.LOAD_IC,
        CodeKind.LOAD_GLOBAL_IC,
        CodeKind.KEYED_LOAD_IC,
        CodeKind.STORE_IC,
        CodeKind.STORE_GLOBAL_IC,
        CodeKind.KEYED_STORE_IC,
    ],

    // 5.1.39:
    // https://github.com/v8/v8/commit/530cc16460b14544760c06484a4aec2413cbd79d#diff-af0936115cfa3d20efe7b10baa7f183bR4876
    // added WASM_TO_JS_FUNCTION
    // added JS_TO_WASM_FUNCTION
    ">=5.1.39": [
        CodeKind.FUNCTION,
        CodeKind.OPTIMIZED_FUNCTION,
        CodeKind.STUB,
        CodeKind.HANDLER,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.WASM_FUNCTION,
        CodeKind.WASM_TO_JS_FUNCTION,
        CodeKind.JS_TO_WASM_FUNCTION,
        CodeKind.LOAD_IC,
        CodeKind.LOAD_GLOBAL_IC,
        CodeKind.KEYED_LOAD_IC,
        CodeKind.STORE_IC,
        CodeKind.STORE_GLOBAL_IC,
        CodeKind.KEYED_STORE_IC,
    ],

    // 4.7.70:
    // https://github.com/v8/v8/commit/3e4fb100f2b#diff-af0936115cfa3d20efe7b10baa7f183bR4624
    // renamed PLACEHOLDER to WASM_FUNCTION
    //
    // 4.7.4
    // https://github.com/v8/v8/commit/e4bcc3363f2#diff-af0936115cfa3d20efe7b10baa7f183bR4465
    // added PLACEHOLDER
    ">=4.7.4": [
        CodeKind.FUNCTION,
        CodeKind.OPTIMIZED_FUNCTION,
        CodeKind.STUB,
        CodeKind.HANDLER,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.WASM_FUNCTION,
        CodeKind.LOAD_IC,
        CodeKind.LOAD_GLOBAL_IC,
        CodeKind.KEYED_LOAD_IC,
        CodeKind.STORE_IC,
        CodeKind.STORE_GLOBAL_IC,
        CodeKind.KEYED_STORE_IC,
    ],

    // Any older and we just use these.
    "*": [
        CodeKind.FUNCTION,
        CodeKind.OPTIMIZED_FUNCTION,
        CodeKind.STUB,
        CodeKind.HANDLER,
        CodeKind.BUILTIN,
        CodeKind.REGEXP,
        CodeKind.LOAD_IC,
        CodeKind.LOAD_GLOBAL_IC,
        CodeKind.KEYED_LOAD_IC,
        CodeKind.STORE_IC,
        CodeKind.STORE_GLOBAL_IC,
        CodeKind.KEYED_STORE_IC,
    ],
});

/**
 * Gets a {@link CodeKind} value derived from the legacy numeric value of a code kind for a specific version of V8.
 * @param value The legacy code kind value.
 * @param version The version of V8 for the legacy code kind value.
 * @returns A normalized {@link CodeKind} value.
 */
export function getCodeKind(value: number, version = V8Version.MAX) {
    return enumVersions.toEnum(value, version);
}

/**
 * Parses a {@link CodeKind} value derived from the legacy string name of a code kind for a specific version of V8.
 * @param value The legacy code kind string name.
 * @param version The version of V8 for the legacy code kind string name.
 * @returns A normalized {@link CodeKind} value.
 */
export function parseCodeKind(value: string, version = V8Version.MAX) {
    return enumVersions.parseEnum(value, version);
}

/**
 * Formats a normalized {@link CodeKind} value using the legacy string name for the value at the time of a specific version of V8.
 * @param value The normalized {@link CodeKind} value.
 * @param version The version of V8 to use to format the code kind.
 * @returns A string value for the {@link CodeKind}.
 */
export function formatCodeKind(value: CodeKind, version = V8Version.MAX) {
    return enumVersions.formatEnum(value, version);
}
