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

export const enum IcState {
    NO_FEEDBACK = 0,
    UNINITIALIZED = 1,
    PREMONOMORPHIC = 2,
    MONOMORPHIC = 3,
    RECOMPUTE_HANDLER = 4,
    POLYMORPHIC = 5,
    MEGAMORPHIC = 6,
    GENERIC = 7,
}

export function parseIcState(text: string) {
    if (text.length === 1) {
        switch (text) {
            case "X": return IcState.NO_FEEDBACK;
            case "0": return IcState.UNINITIALIZED;
            case ".": return IcState.PREMONOMORPHIC;
            case "1": return IcState.MONOMORPHIC;
            case "^": return IcState.RECOMPUTE_HANDLER;
            case "P": return IcState.POLYMORPHIC;
            case "N": return IcState.MEGAMORPHIC;
            case "G": return IcState.GENERIC;
        }
    }
    else {
        switch (text.toLowerCase()) {
            case "uninitialized": return IcState.UNINITIALIZED;
            case "premonomorphic": return IcState.PREMONOMORPHIC;
            case "monomorphic": return IcState.MONOMORPHIC;
            case "recompute handler":
            case "recompute_handler": return IcState.RECOMPUTE_HANDLER;
            case "polymorphic": return IcState.POLYMORPHIC;
            case "megamorphic": return IcState.MEGAMORPHIC;
            case "generic": return IcState.GENERIC;
            case "no feedback":
            case "no_feedback": return IcState.NO_FEEDBACK;
        }
    }
    assert(false, `Unrecognized IC state '${text}'.`);
}

export function formatIcState(state: IcState) {
    switch (state) {
        case IcState.UNINITIALIZED: return "Uninitialized";
        case IcState.PREMONOMORPHIC: return "Premonomorphic";
        case IcState.MONOMORPHIC: return "Monomorphic";
        case IcState.RECOMPUTE_HANDLER: return "Recompute Handler";
        case IcState.POLYMORPHIC: return "Polymorphic";
        case IcState.MEGAMORPHIC: return "Megamorphic";
        case IcState.GENERIC: return "Generic";
        case IcState.NO_FEEDBACK: return "No Feedback";
        default: assert(false, `Argument out of range: state`);
    }
}
