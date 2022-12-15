// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import { TreeItemCollapsibleState } from "vscode";
import { createTreeItem } from "../createTreeItem";
import { BaseNode } from "./baseNode";
import { BaseNodeProvider } from "./baseNodeProvider";

/**
 * A conceptual "page" of nodes in a tree.
 */
export class PageNode extends BaseNode {
    constructor(
        provider: BaseNodeProvider,
        parent: BaseNode | undefined,
        readonly start: number,
        readonly page: BaseNode[],
        readonly formatLabel?: (start: number, page: BaseNode[]) => string | undefined,
        readonly formatDescription?: (start: number, page: BaseNode[]) => string | undefined,
    ) {
        super(provider, parent);
    }

    protected createTreeItem() {
        return createTreeItem(this.formatLabel?.(this.start, this.page) ?? `[${this.start}..${this.start + this.page.length}]`, TreeItemCollapsibleState.Collapsed, {
            contextValue: this.parent?.treeItem.contextValue ? `${this.parent.treeItem.contextValue}-page` : "page",
            description: this.formatDescription?.(this.start, this.page)
        });
    }

    protected getChildren(): Iterable<BaseNode> {
        return from(this.page)
            .select(node => Object.create(node, { _visualParent: { value: this } }) as BaseNode);
    }
}

