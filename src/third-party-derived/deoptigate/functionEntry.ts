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

import { Address } from "#core/address.js";
import { assertNever } from "#core/assert.js";
import { Sources } from "#core/sources.js";
import { TimeTicks } from "#core/time.js";
import { resolveFunctionLocations } from "#extension/components/locations.js";
import { LocationKind, ReferenceableEntryBase } from "#extension/model/entry.js";
import { CodeKind } from "#v8/enums/codeKind.js";
import { FunctionState } from "#v8/enums/functionState.js";
import { Location, SymbolKind, Uri } from "vscode";
import { DeoptEntry, DeoptEntryUpdate } from "./deoptEntry";
import { IcEntry, IcEntryUpdate } from "./icEntry";

export class FunctionEntry extends ReferenceableEntryBase {
    /**
     * Indicates the kind of entry.
     */
    declare kind: "function";

    /**
     * Gets the type of code for this entry. This is usually a string like `"Builtin"`, `"Eval"`, `"LazyCompile"` and varies by v8 version.
     * This is usually related in some way to {@link codeKind}.
     */
    type: string;

    /**
     * Gets the kind of code for this entry.
     * This is usually related in some way to {@link type}.
     */
    codeKind: CodeKind;

    /**
     * Gets the name of the function for this entry.
     */
    functionName: string;
    generatedFunctionName?: string;

    /**
     * Indicates the last known SharedFunctionInfo address
     */
    lastSfiAddress?: Address;

    /**
     * Gets the extent of the function declaration for this entry.
     * If an entry is source-mapped, this points to the extent of the entry in the source file.
     * If an entry is not source-mapped, this points to the extent of the entry reported by the log.
     */
    extentLocation?: Location;

    /**
     * Gets the extent of the function declaration for this entry.
     * If an entry is source-mapped, this points to the extent of the entry in the generated file reported by the log.
     */
    generatedExtentLocation?: Location;

    /**
     * The kind of symbol this function represents.
     */
    symbolKind: SymbolKind = SymbolKind.Function;

    /**
     * Contains a record of each update to this function entry.
     */
    readonly updates: FunctionEntryUpdate[] = [];

    /**
     * Contains a record of each reference to this function entry.
     */
    readonly timeline: FunctionHistoryEvent[] = [];

    constructor (
        sources: Sources,
        type: string,
        codeKind: CodeKind,
        functionName: string,
        filePosition: Location,
    ) {
        super(sources, filePosition);
        this.type = type;
        this.codeKind = codeKind;
        this.functionName = functionName;
    }

    protected onResolveLocations() {
        // This resolves the reference and extent locations for the entry.
        resolveFunctionLocations("generated", this);
        resolveFunctionLocations("source", this);
    }

    isNonUserCode() {
        switch (this.codeKind) {
            case CodeKind.BUILTIN:
                return true;
        }

        if (this.filePosition.uri.scheme === "node") return true;
        return false;
    }

    getExtentLocation(kind: LocationKind) {
        this.resolveLocations();
        if (kind === "source") return this.extentLocation ?? this.referenceLocation ?? this.filePosition;
        if (kind === "generated") return this.generatedExtentLocation ?? this.generatedReferenceLocation ?? this.generatedFilePosition;
        assertNever(kind);
    }

    pickExtentLocation(file: Uri, exact?: false): Location;
    pickExtentLocation(file: Uri, exact?: boolean): Location | undefined;
    pickExtentLocation(file: Uri, exact?: boolean) {
        const kind = this.getLocationKind(file, exact);
        return kind !== undefined ? this.getExtentLocation(kind) : undefined;
    }
}

FunctionEntry.prototype.kind = "function";

export class FunctionEntryUpdate {
    constructor(
        public timestamp: TimeTicks,
        public state: FunctionState
    ) { }
}

export type FunctionHistoryEvent =
    | { event: "created" | "updated", timestamp: TimeTicks, startAddress: Address, funcStartAddress: Address, size: number, state: FunctionState, type: string, codeKind: number }
    | { event: "moved", timestamp: TimeTicks, fromAddress: Address, toAddress: Address }
    | { event: "deleted", timestamp: TimeTicks, startAddress: Address }
    | { event: "sfi-moved", timestamp: TimeTicks, fromAddress: Address, toAddress: Address }
    | { event: "ic", timestamp: TimeTicks, entry: IcEntry, update: IcEntryUpdate }
    | { event: "deopt", timestamp: TimeTicks, entry: DeoptEntry, update: DeoptEntryUpdate }
    ;
