// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import { DeoptEntry } from "#deoptigate/deoptEntry.js";
import { DeoptimizeKind } from "#v8/enums/deoptimizeKind.js";
import { RangeComparer } from "../../../vscode/range";
import { CategoryNode } from "../common/categoryNode";
import type { GroupNode } from "../common/groupNode";
import { DeoptGroupNode } from "./deoptGroupNode";

/**
 * Represents the "Deopts" category within a script file.
 */
export class DeoptCategoryNode extends CategoryNode<DeoptEntry> {
    /**
     * Gets the name of the category.
     */
    get category() { return "Deopts" as const; }

    /**
     * Gets the kind of entry for this category.
     */
    get kind() { return "deopt" as const; }

    protected getChildren(): Iterable<GroupNode<DeoptEntry>> {
        // Return entries grouped by bailout type (i.e., `DeoptimizeKind`). Lower-valued
        // bailout types have a higher performance cost, so we group items by their worst
        // bailout type.
        return from(this.entries)
            .groupBy(entry => from(entry.updates).minBy(update => update.bailoutType)?.bailoutType ?? DeoptimizeKind.Eager)
            .orderBy(group => group.key)
            .thenBy(group => group.key)
            .select(group => new DeoptGroupNode(this, group.key, 
                from(group)
                .orderBy(entry => entry.pickReferenceLocation(this.file).range, RangeComparer)
                .toArray()));
    }
}
