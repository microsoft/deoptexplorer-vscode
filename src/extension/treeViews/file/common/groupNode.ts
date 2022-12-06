// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { TreeItemCollapsibleState, Uri } from "vscode";
import type { Entry } from "../../../model/entry";
import type { LogFile } from "../../../model/logFile";
import type { CanonicalUri } from "../../../services/canonicalPaths";
import { BaseNode } from "../../common/baseNode";
import { createTreeItem } from "../../createTreeItem";
import type { FilesTreeDataProvider } from "../filesTreeDataProvider";
import type { CategoryNode } from "./categoryNode";
import { EntryNode } from "./entryNode";

/**
 * An abstract base class for a group of conceptual tree nodes within a category.
 */
export abstract class GroupNode<TEntry extends Entry> extends BaseNode {
    constructor(parent: CategoryNode<TEntry>, readonly entries: readonly TEntry[]) {
        super(parent.provider, parent);
    }

    /**
     * Gets the provider that provides this node.
     */
    get provider(): FilesTreeDataProvider { return super.provider as FilesTreeDataProvider; }

    /**
     * Gets the parent `CategoryNode` for the group.
     */
    get parent(): CategoryNode<TEntry> { return super.parent as CategoryNode<TEntry>; }

    /**
     * Gets the canonical path to the file for the group.
     */
    get file(): CanonicalUri { return this.parent.file; }

    /**
     * Gets the base path to the file for the group.
     */
    get base(): Uri | undefined { return this.parent.base; }

    /**
     * Gets the `LogFile` associated with this node.
     */
    get log(): LogFile { return this.parent.log; }

    /**
     * Gets the name of the group.
     * 
     * Note to inheritors: You must override this to provide the name for the corresponding visual `TreeItem`.
     */
    protected abstract get groupName(): string;

    protected createTreeItem() {
        return createTreeItem(this.groupName, TreeItemCollapsibleState.Collapsed, {
            contextValue: "group",
            description: `${this.entries.length}`
        });
    }

    /**
     * Gets the children for this node.
     *
     * Note to inheritors: You may override this method to provide children for this node, if the node has children.
     * @returns
     */
    protected abstract getChildren(): Iterable<BaseNode>;

    /**
     * Finds the conceptual tree node corresponding to the provided entry.
     */
    async findNode(entry: TEntry) {
        if (this.entries.includes(entry)) {
            for (const child of await this.children) {
                if (child instanceof EntryNode && child.entry === entry) {
                    return child;
                }
            }
        }
    }
}

