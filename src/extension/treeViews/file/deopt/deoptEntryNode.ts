// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import { markdown } from "#core/markdown.js";
import { DeoptEntry } from "#deoptigate/deoptEntry.js";
import { DeoptimizeKind, DeoptimizeKindComparer, formatDeoptimizeKind } from "#v8/enums/deoptimizeKind.js";
import { CancellationToken, MarkdownString, ProviderResult, TreeItem } from "vscode";
import { openedLog } from "../../../services/currentLogFile";
import { EntryNode } from "../common/entryNode";
import { DeoptGroupNode } from "./deoptGroupNode";

/**
 * Represents a deoptimization.
 */
export class DeoptEntryNode extends EntryNode<DeoptEntry> {
    constructor(parent: DeoptGroupNode, entry: DeoptEntry) {
        super(parent, entry);
    }

    /**
     * Gets the conceptual parent of this node.
     */
    get parent(): DeoptGroupNode { return super.parent as DeoptGroupNode; }

    protected formatLabel() {
        // Deopt entries are labeled by the bailout reason for their worst bailout type, or `"Unknown"` if
        // no reason was provided.
        const worstBailoutType =
            from(this.entry.updates)
            .select(update => update.bailoutType)
            .min(DeoptimizeKindComparer.compare);
        const worstBailouts =
            from(this.entry.updates)
            .where(update => update.bailoutType === worstBailoutType)
            .toArray();
        const deoptReason =
            from(worstBailouts)
            .reverse()
            .select(update => update.deoptReason)
            .first(reason => reason.length > 0) ?? "(unknown)";
        return deoptReason;
    }

    protected override formatTooltip(): string | MarkdownString | undefined {
        return undefined;
    }

    resolveTreeItem(treeItem: TreeItem, token: CancellationToken): ProviderResult<TreeItem> {
        const bailouts: MarkdownString[] = [];

        let lastBailoutType: DeoptimizeKind | undefined;
        let lastDeoptReason: string | undefined;
        for (const update of this.entry.updates) {
            // if this is the first update, track it and continue
            if (lastBailoutType === undefined || lastDeoptReason === undefined) {
                lastBailoutType = update.bailoutType;
                lastDeoptReason = update.deoptReason;
                continue;
            }

            // if we change bailout types, record the last bailout and reason
            if (update.bailoutType !== lastBailoutType) {
                bailouts.push(markdown`${formatDeoptimizeKind(lastBailoutType, openedLog?.version)} - ${lastDeoptReason || "(unknown)"}  \n`);
                lastBailoutType = update.bailoutType;
                lastDeoptReason = update.deoptReason;
                break;
            }

            // if we only change reasons, only record the last bailout and reason if the reason was is non-empty.
            if (update.deoptReason !== lastDeoptReason) {
                if (lastDeoptReason) {
                    bailouts.push(markdown`${formatDeoptimizeKind(lastBailoutType, openedLog?.version)} - ${lastDeoptReason || "(unknown)"}  \n`);
                }
                lastDeoptReason = update.deoptReason;
                break;
            }
        }

        // record the last bailout
        if (lastBailoutType) {
            bailouts.push(markdown`${formatDeoptimizeKind(lastBailoutType, openedLog?.version)} - ${lastDeoptReason || "(unknown)"}`);
            bailouts.unshift(
                markdown`\n\n`,
                markdown`**Bailouts:**  \n`
            );
        }

        treeItem.tooltip = markdown`${[
            markdown`${this.formatLabel()}`,
            ...bailouts
        ]}`;

        return treeItem;
    }

    protected recordEntry() {
        this.provider.deoptNodes.set(this.entry, this);
    }
}
