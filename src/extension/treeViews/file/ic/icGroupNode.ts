// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import type { IcEntry } from "../../../../third-party-derived/deoptigate/icEntry";
import { IcState, formatIcState } from "../../../../third-party-derived/v8/enums/icState";
import { PositionComparer } from "../../../vscode/position";
import { BaseNode } from "../../common/baseNode";
import { GroupNode } from "../common/groupNode";
import type { IcCategoryNode } from "./icCategoryNode";
import { IcEntryNode } from "./icEntryNode";

/**
 * Represents a group of inline cache events organized by IC state.
 */
export class IcGroupNode extends GroupNode<IcEntry> {
    constructor(
        parent: IcCategoryNode,
        readonly state: IcState,
        entries: IcEntry[]
    ) {
        super(parent, entries);
    }

    /**
     * Gets the conceptual parent of this node.
     */
    get parent(): IcCategoryNode { return super.parent as IcCategoryNode; }

    /**
     * Gets the name of the group.
     */
    protected get groupName() {
        // IC groups are labeled by their IC state.
        return formatIcState(this.state);
    }

    protected getChildren(): Iterable<BaseNode> {
        return from(this.entries)
            .orderBy(entry => entry.filePosition.range.start, PositionComparer)
            .select(entry => new IcEntryNode(this, entry));
    }
}
