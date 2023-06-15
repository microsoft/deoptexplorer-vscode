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

export const enum IcType {
    /**
     * Indicates an inline cache for loading a named global variable.
     */
    LoadGlobalIC = "LoadGlobalIC",

    /**
     * Indicates an inline cache for storing a named global variable.
     */
    StoreGlobalIC = "StoreGlobalIC",

    /**
     * Represents an inline cache for loading a variable.
     */
    LoadIC = "LoadIC",

    /**
     * Represents an inline cache for storing a variable.
     */
    StoreIC = "StoreIC",

    /**
     * Represents an inline cache for loading a property.
     */
    KeyedLoadIC = "KeyedLoadIC",

    /**
     * Represents an inline cache for storing a property.
     */
    KeyedStoreIC = "KeyedStoreIC",

    /**
     * Represents an inline cache for storing an element in an array.
     */
    StoreInArrayLiteralIC = "StoreInArrayLiteralIC",
}

export function parseIcType(text: string) {
    switch (text.toLowerCase()) {
        case "loadglobalic": return IcType.LoadGlobalIC;
        case "storeglobalic": return IcType.StoreGlobalIC;
        case "loadic": return IcType.LoadIC;
        case "storeic": return IcType.StoreIC;
        case "keyedloadic": return IcType.KeyedLoadIC;
        case "keyedstoreic": return IcType.KeyedStoreIC;
        case "storeinarrayliteralic": return IcType.StoreInArrayLiteralIC;
        default: assert(false, `Unrecognized IC type '${text}'.`);
    }
}

export function formatIcType(icType: IcType): string {
    return icType;
}
