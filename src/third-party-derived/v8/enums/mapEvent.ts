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

export const enum MapEvent {
    InitialMap = "InitialMap",
    Normalize = "Normalize",
    Transition = "Transition",
    ReplaceDescriptors = "ReplaceDescriptors",
    SlowToFast = "SlowToFast",
    Deprecate = "Deprecate",

    // Added in 8.9.79
    // https://github.com/v8/v8/commit/02ab03b9e8d07f09bcfba456e02b7baa4e4eac18#diff-69c61bffac6f10589d4a6f8392d22ca12a5f9472558fc2a67b8dfd0217535958R1523
    NormalizeCached = "NormalizeCached",
}

export function parseMapEvent(text: string) {
    switch (text.toLowerCase()) {
        case "initialmap": return MapEvent.InitialMap;
        case "normalize": return MapEvent.Normalize;
        case "normalizecached": return MapEvent.NormalizeCached;
        case "transition": return MapEvent.Transition;
        case "replacedescriptors": return MapEvent.ReplaceDescriptors;
        case "slowtofast": return MapEvent.SlowToFast;
        case "deprecate": return MapEvent.Deprecate;
        default: assert(false, `Unrecognized map event '${text}'.`);
    }
}

export function formatMapEvent(value: MapEvent): string {
    return value;
}
