// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import type { IcEntry } from "#deoptigate/icEntry.js";
import { IcState } from "#v8/enums/icState.js";
import { RangeComparer } from "../../../vscode/range";
import { CategoryNode } from "../common/categoryNode";
import type { GroupNode } from "../common/groupNode";
import { IcGroupNode } from "./icGroupNode";

/**
 * Represents the "ICs" (or "Inline Cache events") within a script file.
 */
export class IcCategoryNode extends CategoryNode<IcEntry> {
    /**
     * Gets the name of the category.
     */
    get category() { return "ICs" as const; }

    /**
     * Gets the kind of entry for this category.
     */
    get kind() { return "ic" as const; }

    protected getChildren(): Iterable<GroupNode<IcEntry>> {
        // Returns entries grouped by their worst inline cache state.
        return from(this.entries)
            .groupBy(entry => from(entry.updates).maxBy(update => update.newState)?.newState ?? IcState.NO_FEEDBACK)
            .orderByDescending(group => group.key)
            .thenBy(group => group.key)
            .select(group => new IcGroupNode(this, group.key, from(group)
                .orderBy(entry => entry.pickReferenceLocation(this.file).range, RangeComparer)
                .toArray()));
    }
}
