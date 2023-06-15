// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import type { IcEntry } from "#deoptigate/icEntry.js";
import { formatIcState } from "#v8/enums/icState.js";
import { EntryNode } from "../common/entryNode";
import { IcGroupNode } from "./icGroupNode";

export class IcEntryNode extends EntryNode<IcEntry> {
    constructor(parent: IcGroupNode, entry: IcEntry) {
        super(parent, entry);
    }

    /**
     * Gets the conceptual parent of this node.
     */
    get parent(): IcGroupNode { return super.parent as IcGroupNode; }

    private formatLabelCommon() {
        // IC entries are labeled by their worst IC state
        const update = from(this.entry.updates).maxBy(update => update.newState);
        const title = update ? `${update.type}: ${formatIcState(update.newState)}` : "Unknown";
        return title;
    }

    protected formatLabel() {
        return `${this.formatLabelCommon()} (${this.entry.updates.length})`;
    }

    protected formatTooltip() {
        return `${this.formatLabelCommon()}\nHit count: ${this.entry.updates.length}`;
    }

    protected recordEntry() {
        this.provider.icNodes.set(this.entry, this);
    }
}
