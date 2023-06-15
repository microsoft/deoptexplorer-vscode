// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
//
// THIRD PARTY LICENSE NOTICE:
//
// Portions of this code are sourced from deoptigate:
//
//  Copyright 2017 Thorsten Lorenz. All rights reserved.
//  Use of this source code is goverened by the license that can be found
//  in the LICENSE.deoptigate file.

import { from } from "@esfx/iter-query";
import { Sources } from "#core/sources.js";
import { TimeTicks } from "#core/time.js";
import { resolveIcLocations } from "#extension/components/locations.js";
import { ReferenceableEntryBase } from "#extension/model/entry.js";
import type { MapEntry, MapId } from "#extension/model/mapEntry.js";
import { FunctionState } from "#v8/enums/functionState.js";
import { IcState } from "#v8/enums/icState.js";
import { IcType } from "#v8/enums/icType.js";
import { Location } from "vscode";
import { FunctionEntry } from "./functionEntry";

/**
 * Represents an inline cache at a particular file position.
 */
export class IcEntry extends ReferenceableEntryBase {
    /**
     * Indicates the kind of entry.
     */
    declare kind: "ic";

    /**
     * Gets the name of the function for this entry.
     */
    functionName: string;
    generatedFunctionName?: string;

    /**
     * Contains a record of each inline-cache event for this location.
     */
    readonly updates: IcEntryUpdate[] = [];

    constructor(
        sources: Sources,
        functionName: string,
        filePosition: Location,
    ) {
        super(sources, filePosition);
        this.functionName = functionName;
    }

    getWorstUpdate() {
        return from(this.updates)
            .maxBy(update => update.newState);
    }

    getWorstIcState() {
        return from(this.updates)
               .select(update => update.newState)
               .max() ?? IcState.NO_FEEDBACK;
    }

    protected onResolveLocations() {
        // This resolves the reference locations for the entry.
        resolveIcLocations("generated", this);
        resolveIcLocations("source", this);
    }
}

IcEntry.prototype.kind = "ic";

/**
 * Represents an update to an inline cache
 */
export class IcEntryUpdate {
    functionEntry?: FunctionEntry;
    constructor(
        public timestamp: TimeTicks,
        public type: IcType,
        public oldState: IcState,
        public newState: IcState,
        public key: string,
        public mapId: MapId,
        public map: MapEntry | undefined,
        public optimizationState: FunctionState | undefined,
    ) { }
}
