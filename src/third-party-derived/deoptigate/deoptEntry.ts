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

import { Sources } from "#core/sources.js";
import { TimeTicks } from "#core/time.js";
import { resolveDeoptLocations } from "#extension/components/locations.js";
import { ReferenceableEntryBase } from "#extension/model/entry.js";
import { DeoptimizeKind } from "#v8/enums/deoptimizeKind.js";
import { FunctionState } from "#v8/enums/functionState.js";
import { Location } from "vscode";
import { FunctionEntry } from "./functionEntry";

/**
 * Represents a deoptimization at a specific file location.
 */
export class DeoptEntry extends ReferenceableEntryBase {
    /**
     * Indicates the kind of entry.
     */
    declare kind: "deopt";

    /**
     * Gets the name of the function for this entry.
     */
    functionName: string;
    generatedFunctionName?: string;

    /**
     * Contains a record of each deoptimization event for this location.
     */
    readonly updates: DeoptEntryUpdate[] = [];

    constructor(
        sources: Sources | undefined,
        functionName: string,
        filePosition: Location,
    ) {
        super(sources, filePosition);
        this.functionName = functionName;
    }

    protected onResolveLocations() {
        // This resolves the reference locations for the entry.
        resolveDeoptLocations("generated", this);
        resolveDeoptLocations("source", this);
    }
}

DeoptEntry.prototype.kind = "deopt";

/**
 * Represents an update to a {@link DeoptEntry} in its timeline.
 */
export class DeoptEntryUpdate {
    functionEntry?: FunctionEntry;
    /**
     * @param timestamp The timestamp at which the update occurred.
     * @param bailoutType The type of bailout that caused the deoptimization.
     * @param deoptReason The reason for the deoptimization.
     * @param optimizationState The optimization state of the function at the time of the deoptimization.
     * @param inliningId The inliningId for any inlined function where the deoptimization occurs.
     * @param scriptOffset The offset into the script where the deoptimization occurred.
     */
    constructor(
        public timestamp: TimeTicks,
        public bailoutType: DeoptimizeKind,
        public deoptReason: string,
        public optimizationState: FunctionState | undefined,
        public inliningId: number,
        public scriptOffset: number,
    ) {
    }
}
