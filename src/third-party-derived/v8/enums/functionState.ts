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

export const enum FunctionState {
    // Corresponds to CodeKind::INTERPRETED_FUNCTION when optimization is enabled, per:
    // https://github.com/v8/v8/blob/f1589bbe11f997b9c81d1f474b8acaeedcc40f16/src/logging/log.cc#L80
    Interpreted = "~",

    // Corresponds to all other CodeKind values not mentioned below
    Compiled = "",

    // since 9.0.170, per: https://github.com/v8/v8/blob/c913ef3a915aeccfcdbf37edbba0d3f926c0a1f5/src/objects/code-kind.cc#L25
    // see: https://v8.dev/blog/sparkplug
    CompiledSparkplug = "^",

    NativeContextIndependent = "-",

    // Corresponds to CodeKind::OPTIMIZED_FUNCTION and CodeKind::NATIVE_CONTEXT_INDEPENDENT, per:
    // https://github.com/v8/v8/blob/f1589bbe11f997b9c81d1f474b8acaeedcc40f16/src/logging/log.cc#L81
    Optimized = "*",
    // OptimizedTurbofan = Optimized

    // since 8.9.75, per: https://github.com/v8/v8/commit/c0f72de764e1651b58b88ea741275674394c13fe
    OptimizedTurboprop = "+",

    // since 10.2.110, per: https://github.com/v8/v8/commit/91c5b18658de014cc4e709dcb0fc9700d93bac33
    OptimizedMaglev = "+",

    // NOTE: not a V8 function state.
    Inlined = "<inlined>"
}

export function isCompiledFunctionState(value: FunctionState): value is FunctionState.Compiled {
    return value === FunctionState.Compiled;
}

export function isInterpretedFunctionState(value: FunctionState): value is FunctionState.Interpreted {
    return value === FunctionState.Interpreted;
}

export function isOptimizedFunctionState(value: FunctionState): value is FunctionState.Optimized | FunctionState.OptimizedTurboprop | FunctionState.Inlined {
    switch (value) {
        case FunctionState.Optimized:
        case FunctionState.OptimizedTurboprop:
        case FunctionState.Inlined:
            return true;
    }
    return false;
}

export function parseFunctionState(text: string) {
    switch (text.toLowerCase()) {
        case "":
        case "compiled":
            return FunctionState.Compiled;
        case "~":
        case "optimizable":
        case "interpreted":
            return FunctionState.Interpreted;
        case "*":
        case "deoptimized":
        case "optimized":
        case "optimized (turbofan)":
            return FunctionState.Optimized;
        case "^":
        case "baseline":
        case "sparkplug":
        case "compiled (sparkplug)":
            return FunctionState.CompiledSparkplug;
        case "+":
        case "turboprop":
        case "maglev":
        case "optimized (turboprop)":
        case "optimized (maglev)":
            return FunctionState.OptimizedTurboprop;
        case "inlined":
            return FunctionState.Inlined;
        default:
            assert(false, `Unrecognized function state '${text}'.`);
    }
}

export function formatFunctionState(value: FunctionState) {
    switch (value) {
        case FunctionState.Compiled: return "Compiled";
        case FunctionState.CompiledSparkplug: return "Compiled (sparkplug)";
        case FunctionState.Interpreted: return "Interpreted";
        case FunctionState.Optimized: return "Optimized (turbofan)";
        case FunctionState.OptimizedTurboprop: return "Optimized (turboprop)";
        case FunctionState.Inlined: return "Inlined";
        default: assert(false, "Argument out of range: value");
    }
}
