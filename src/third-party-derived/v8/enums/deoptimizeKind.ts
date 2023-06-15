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

import { Comparer } from "@esfx/equatable";
import { V8Version } from "#core/v8Version.js";
import { VersionedEnum } from "#core/versionedEnum.js";

// https://github.com/v8/v8/blob/537fb908eb45852505731f6d0949754180435d1b/src/common/globals.h#L503
export const enum DeoptimizeKind {
    // Current as of 8.9.75
    /**
     * a check failed in the optimized code and deoptimization happens immediately.
     */
    Eager,
    /**
     * Similar to lazy deoptimization, but does not contribute to the total deopt count which can lead to disabling optimization for a function.
     */
    Soft,
    /**
     * Similar to soft deoptimization, but reuses the code after bailing out for a single execution.
     *
     * NOTE: This doesn't exist in the DeoptimizeKind enum in V8, but represents the `DeoptimizeKind::kSoft` state with `reuse_code=true`
     */
    BailoutSoft,
    /**
     * A check failed in the optimized code but we don't deoptimize the code, but try to heal the feedback and try to rerun the optimized code again.
     */
    Bailout,
    /**
     * The code has been marked as dependent on some assumption which
     * is checked elsewhere and can trigger deoptimization the next time the
     * code is executed.
     */
    Lazy,
    /**
     * Used in a dynamic map check, either eagerly deoptimizes if necessary or resumes execution if the check succeeds.
     */
    EagerWithResume,

    /** NOTE: Not an actual DeoptimizeKind */
    DependencyChange,
}

const enumVersions = new VersionedEnum<DeoptimizeKind>("DeoptimizeKind", {
    // 8.9.75:
    // https://github.com/v8/v8/commit/b6643320b9620ecf873378e43a634d4e0c7b6e70#diff-03cb202c050b5ce13103367e2ae8b538709bc730eeb22db9da95308d12749981R485
    // Added EagerWithResume
    ">=8.9.75": [
        [DeoptimizeKind.Eager, "Eager", "deopt-eager", /*back compat*/ "eager"],
        [DeoptimizeKind.Soft, "Soft", "deopt-soft", /*back compat*/ "soft"],
        [DeoptimizeKind.BailoutSoft, "Bailout Soft", "bailout-soft"],
        [DeoptimizeKind.Bailout, "Bailout", "bailout"],
        [DeoptimizeKind.Lazy, "Lazy", "deopt-lazy", /*back compat*/ "lazy"],
        [DeoptimizeKind.EagerWithResume, "Eager with Resume", "eager-with-resume"],
        [DeoptimizeKind.DependencyChange, "Dependency Change", "dependency-change"],
    ],

    // 8.6.218:
    // https://github.com/v8/v8/commit/97d7501327d5e85e3d303a929191fc5cffb6f24e#diff-03cb202c050b5ce13103367e2ae8b538709bc730eeb22db9da95308d12749981R496
    // Added Bailout
    ">=8.6.218": [
        [DeoptimizeKind.Eager, "Eager", "deopt-eager", /*back compat*/ "eager"],
        [DeoptimizeKind.Soft, "Soft", "deopt-soft", /*back compat*/ "soft"],
        [DeoptimizeKind.BailoutSoft, "Bailout Soft", "bailout-soft"],
        [DeoptimizeKind.Bailout, "Bailout", "bailout"],
        [DeoptimizeKind.Lazy, "Lazy", "deopt-lazy", /*back compat*/ "lazy"],
        [DeoptimizeKind.DependencyChange, "Dependency Change", "dependency-change"],
    ],

    // 8.6.79:
    // https://github.com/v8/v8/commit/f41e519f650a01960d25841e09d2bb95476b9580#diff-03cb202c050b5ce13103367e2ae8b538709bc730eeb22db9da95308d12749981R469
    // Renamed deopts, added bailout-soft
    ">=8.6.79": [
        [DeoptimizeKind.Eager, "Eager", "deopt-eager", /*back compat*/ "eager"],
        [DeoptimizeKind.Soft, "Soft", "deopt-soft", /*back compat*/ "soft"],
        [DeoptimizeKind.BailoutSoft, "Bailout Soft", "bailout-soft"],
        [DeoptimizeKind.Lazy, "Lazy", "deopt-lazy", /*back compat*/ "lazy"],
        [DeoptimizeKind.DependencyChange, "Dependency Change", "dependency-change"],
    ],

    // Any older and we just use these.
    "*": [
        [DeoptimizeKind.Eager, "Eager", "eager"],
        [DeoptimizeKind.Soft, "Soft", "soft"],
        [DeoptimizeKind.Lazy, "Lazy", "lazy"],
    ]
});

/**
 * Gets a {@link DeoptimizeKind} value derived from the legacy numeric value of a deoptimize kind for a specific version of V8.
 * @param value The legacy deoptimize kind value.
 * @param version The version of V8 for the legacy deoptimize kind value.
 * @returns A normalized {@link DeoptimizeKind} value.
 */
export function getDeoptimizeKind(value: number, version = V8Version.MAX) {
    return enumVersions.toEnum(value, version);
}

/**
 * Parses a {@link DeoptimizeKind} value derived from the legacy string name of a deoptimize kind for a specific version of V8.
 * @param value The legacy deoptimize kind string name.
 * @param version The version of V8 for the legacy deoptimize kind string name.
 * @returns A normalized {@link DeoptimizeKind} value.
 */
export function parseDeoptimizeKind(text: string, version = V8Version.MAX, ignoreCase?: boolean) {
    return enumVersions.parseEnum(text, version, ignoreCase);
}

/**
 * Formats a normalized {@link DeoptimizeKind} value using the legacy string name for the value at the time of a specific version of V8.
 * @param value The normalized {@link DeoptimizeKind} value.
 * @param version The version of V8 to use to format the deoptimize kind.
 * @returns A string value for the {@link DeoptimizeKind}.
 */
export function formatDeoptimizeKind(kind: DeoptimizeKind, version = V8Version.MAX) {
    return enumVersions.formatEnum(kind, version);
}

function priority(kind: DeoptimizeKind) {
    switch (kind) {
        case DeoptimizeKind.Eager: return 0;
        case DeoptimizeKind.EagerWithResume: return 1;
        case DeoptimizeKind.Soft: return 2;
        case DeoptimizeKind.BailoutSoft: return 3;
        case DeoptimizeKind.Bailout: return 4;
        case DeoptimizeKind.Lazy: return 5;
        default: return 6;
    }
}

export const DeoptimizeKindComparer = Comparer.create<DeoptimizeKind>(
    (a, b) => priority(a) - priority(b)
);