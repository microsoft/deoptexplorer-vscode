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
import { Location } from "vscode";
import { Sources } from "../../core/sources";
import { TimeTicks } from "../../core/time";
import { resolveIcLocations } from "../../extension/components/locations";
import { ReferenceableEntryBase } from "../../extension/model/entry";
import type { MapEntry, MapId } from "../../extension/model/mapEntry";
import { FunctionState } from "../v8/enums/functionState";
import { IcState } from "../v8/enums/icState";
import { IcType } from "../v8/enums/icType";

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
