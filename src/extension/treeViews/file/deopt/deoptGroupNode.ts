// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import type { DeoptEntry } from "#deoptigate/deoptEntry.js";
import { DeoptimizeKind, formatDeoptimizeKind } from "#v8/enums/deoptimizeKind.js";
import type { BaseNode } from "../../common/baseNode";
import { GroupNode } from "../common/groupNode";
import { DeoptCategoryNode } from "./deoptCategoryNode";
import { DeoptEntryNode } from "./deoptEntryNode";

/**
 * Represents a group of deopts organized by their bailout type.
 */
export class DeoptGroupNode extends GroupNode<DeoptEntry> {
    constructor(
        parent: DeoptCategoryNode,
        readonly bailoutType: DeoptimizeKind,
        entries: DeoptEntry[]
    ) {
        super(parent, entries);
    }

    /**
     * Gets the conceptual parent of this node.
     */
    get parent(): DeoptCategoryNode { return super.parent as DeoptCategoryNode; }

    /**
     * Gets the name of the group.
     */
    get groupName() {
        // Deopt groups are labeled by the string value of their bailout type.
        return formatDeoptimizeKind(this.bailoutType);
    }

    protected getChildren(): Iterable<BaseNode> {
        return from(this.entries)
            .select(entry => new DeoptEntryNode(this, entry));
    }
}
