// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import type { FunctionEntry } from "#deoptigate/functionEntry.js";
import { formatFunctionState, FunctionState } from "#v8/enums/functionState.js";
import type { BaseNode } from "../../common/baseNode";
import { GroupNode } from "../common/groupNode";
import type { FunctionCategoryNode } from "./functionCategoryNode";
import { FunctionEntryNode } from "./functionEntryNode";

/**
 * Represents a group of functions organized by function state.
 */
export class FunctionGroupNode extends GroupNode<FunctionEntry> {
    constructor(
        parent: FunctionCategoryNode,
        readonly state: FunctionState | -1,
        entries: readonly FunctionEntry[]
    ) {
        super(parent, entries);
    }

    /**
     * Gets the conceptual parent of this node.
     */
    get parent(): FunctionCategoryNode { return super.parent as FunctionCategoryNode; }

    /**
     * Gets the name of the group.
     */
    get groupName() {
        // Function groups are labeled by the string value of their function state.
        // The magic number `-1` is used to indicate a function that was re-optimized more than once.
        return this.state === -1 ? "Reoptimized" : formatFunctionState(this.state);
    }

    protected getChildren(): Iterable<BaseNode> {
        return from(this.entries)
            .select(entry => new FunctionEntryNode(this, entry));
    }
}
