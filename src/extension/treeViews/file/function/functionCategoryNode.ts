// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import type { FunctionEntry } from "#deoptigate/functionEntry.js";
import { FunctionState, isOptimizedFunctionState } from "#v8/enums/functionState.js";
import { RangeComparer } from "../../../vscode/range";
import { CategoryNode } from "../common/categoryNode";
import type { GroupNode } from "../common/groupNode";
import { FunctionGroupNode } from "./functionGroupNode";

/**
 * Represents the "Functions" category within a script file.
 */
export class FunctionCategoryNode extends CategoryNode<FunctionEntry> {
    /**
     * Gets the name of the category.
     */
    get category() { return "Functions" as const; }

    /**
     * Gets the kind of entry for this category.
     */
    get kind() { return "function" as const; }

    protected getChildren(): Iterable<GroupNode<FunctionEntry>> {
        // Return entries grouped by the last recorded functon state.
        // If a function has been "optimized" more than once, we use the state `-1` indicating recompilation.
        return from(this.entries)
            .groupBy(entry => from(entry.updates).count(update => isOptimizedFunctionState(update.state)) > 1 ? -1 : from(entry.updates).last()?.state ?? FunctionState.Compiled)
            .orderBy(group => group.key, (a, b) => getFunctionStateWeight(a) - getFunctionStateWeight(b))
            .select(group => new FunctionGroupNode(this, group.key, from(group)
                .orderByDescending(entry => entry.updates.length)
                .thenBy(entry => entry.pickReferenceLocation(this.file).range, RangeComparer)
                .toArray()));
    }
}

function getFunctionStateWeight(state: FunctionState | -1) {
    switch (state) {
        case FunctionState.Interpreted: return 0;
        default:
        case FunctionState.Compiled: return 1;
        case FunctionState.CompiledSparkplug: return 2;
        case FunctionState.NativeContextIndependent: return 3;
        case FunctionState.OptimizedTurboprop: return 4;
        case FunctionState.OptimizedMaglev: return 5;
        case FunctionState.Optimized: return 6;
        case FunctionState.Inlined: return 7;
        case -1: return 8;
    }
}