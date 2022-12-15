// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import { CancellationToken, ProviderResult, TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import { markdown, MarkdownString } from "../../../core/markdown";
import { DeoptEntry } from "../../../third-party-derived/deoptigate/deoptEntry";
import { DeoptimizeKind, DeoptimizeKindComparer, formatDeoptimizeKind } from "../../../third-party-derived/v8/enums/deoptimizeKind";
import { FunctionReference } from "../../model/functionReference";
import { formatLocation } from "../../vscode/location";
import { BaseNode } from "../common/baseNode";
import { createTreeItem } from "../createTreeItem";
import { DeoptTreeDataProvider } from "./deoptTreeDataProvider";

export class DeoptNode extends BaseNode {
    private _functionReference: FunctionReference | null | undefined;
    private _file: Uri | undefined;
    private _worstBailoutType: DeoptimizeKind | null | undefined;

    constructor(
        provider: DeoptTreeDataProvider,
        parent: BaseNode | undefined,
        readonly deopt: DeoptEntry,
    ) {
        super(provider, parent);
    }

    get provider() { return super.provider as DeoptTreeDataProvider; }
    get file() { return this._file ??= this.deopt.filePosition.uri; }
    get functionReference() {
        if (this._functionReference === undefined) {
            const functionEntry = from(this.deopt.updates).maxBy(update => update.bailoutType, DeoptimizeKindComparer)?.functionEntry;
            this._functionReference = (functionEntry && FunctionReference.fromFunctionEntry(functionEntry)) ?? null;
        }
        return this._functionReference ?? undefined;
    }
    get worstBailoutType() {
        if (this._worstBailoutType === undefined) {
            this._worstBailoutType = from(this.deopt.updates)
                .select(update => update.bailoutType)
                .min(DeoptimizeKindComparer) ?? null;
        }
        return this._worstBailoutType ?? undefined;
    }

    protected formatLabel() {
        // Deopt entries are labeled by the bailout reason for their worst bailout type, or `"(no reason given)"` if
        // no reason was provided.
        const worstBailoutType = this.worstBailoutType;
        const worstBailouts =
            from(this.deopt.updates)
            .where(update => update.bailoutType === worstBailoutType)
            .toArray();
        const deoptReason =
            from(worstBailouts)
            .reverse()
            .select(update => update.deoptReason)
            .first(reason => reason.length > 0) ?? "(no reason given)";
        return deoptReason;
    }

    protected override createTreeItem() {
        const label = this.formatLabel();
        const relativeTo = this.provider.log && { log: this.provider.log, ignoreIfBasename: true };
        const description = formatLocation(this.deopt.referenceLocation, { as: "file", skipEncoding: true, include: "position", relativeTo }) || "(unknown)";
        return createTreeItem(label, TreeItemCollapsibleState.None, {
            contextValue: "",
            description: description,
            command: this.deopt.referenceLocation && {
                title: "Go to Deopt",
                command: "vscode.open",
                arguments: [
                    this.deopt.referenceLocation.uri,
                    {
                        preview: true,
                        selection: this.deopt.referenceLocation.range
                    }
                ]
            }
        });
    }

    override resolveTreeItem(treeItem: TreeItem, token: CancellationToken): ProviderResult<TreeItem> {
        const bailouts: MarkdownString[] = [];

        let lastBailoutType: DeoptimizeKind | undefined;
        let lastDeoptReason: string | undefined;
        for (const update of this.deopt.updates) {
            // if this is the first update, track it and continue
            if (lastBailoutType === undefined || lastDeoptReason === undefined) {
                lastBailoutType = update.bailoutType;
                lastDeoptReason = update.deoptReason;
                continue;
            }

            // if we change bailout types, record the last bailout and reason
            if (update.bailoutType !== lastBailoutType) {
                bailouts.push(markdown`${formatDeoptimizeKind(lastBailoutType, this.provider.log?.version)} - ${lastDeoptReason || "(unknown)"}  \n`);
                lastBailoutType = update.bailoutType;
                lastDeoptReason = update.deoptReason;
                break;
            }

            // if we only change reasons, only record the last bailout and reason if the reason was is non-empty.
            if (update.deoptReason !== lastDeoptReason) {
                if (lastDeoptReason) {
                    bailouts.push(markdown`${formatDeoptimizeKind(lastBailoutType, this.provider.log?.version)} - ${lastDeoptReason || "(unknown)"}  \n`);
                }
                lastDeoptReason = update.deoptReason;
                break;
            }
        }

        // record the last bailout
        if (lastBailoutType !== undefined) {
            bailouts.push(markdown`${formatDeoptimizeKind(lastBailoutType, this.provider.log?.version)} - ${lastDeoptReason || "(unknown)"}`);
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
}
