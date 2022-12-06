// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ThemeColor, ThemeIcon, TreeItemCollapsibleState, Uri } from "vscode";
import type { Entry } from "../../../model/entry";
import type { LogFile } from "../../../model/logFile";
import type { CanonicalUri } from "../../../services/canonicalPaths";
import { BaseNode } from "../../common/baseNode";
import { createTreeItem } from "../../createTreeItem";
import type { FileNode } from "../fileNode";
import type { FilesTreeDataProvider } from "../filesTreeDataProvider";
import { GroupNode } from "./groupNode";

/**
 * An abstract base class for a conceptual tree node representing a category of other nodes belonging to a script file.
 */
export abstract class CategoryNode<TEntry extends Entry> extends BaseNode {
    constructor(parent: FileNode, readonly entries: readonly TEntry[]) {
        super(parent.provider, parent);
    }

    /**
     * Gets the provider that provides this node.
     */
    get provider(): FilesTreeDataProvider { return super.provider as FilesTreeDataProvider; }

    /**
     * Gets the parent `FileNode` for the category.
     */
    get parent(): FileNode { return super.parent as FileNode; }

    /**
     * Gets the canonical path to the file for the category.
     */
    get file(): CanonicalUri { return this.parent.file; }

    /**
     * Gets the base path to the file for the category.
     */
    get base(): Uri | undefined { return this.parent.base; }

    /**
     * Gets the `LogFile` associated with this node.
     */
    get log(): LogFile { return this.parent.log; }

    /**
     * Gets the name of the category.
     *
     * Note to inheritors: This method must be overriden in a derived class.
     */
    abstract get category(): string;

    /**
     * Gets the kind of entry for this category.
     *
     * Note to inheritors: This method must be overriden in a derived class.
     */
    abstract get kind(): TEntry["kind"];

    protected createTreeItem() {
        return createTreeItem(this.category, TreeItemCollapsibleState.Collapsed, {
            contextValue: "category",
            iconPath:
                this.kind === "function" ? new ThemeIcon("symbol-function", new ThemeColor("icon.foreground")) :
                this.kind === "ic" ? new ThemeIcon("symbol-value", new ThemeColor("icon.foreground")) :
                this.kind === "deopt" ? new ThemeIcon("question", new ThemeColor("icon.foreground")) :
                undefined,
            description: `${this.entries.length}`
        });
    }

    /**
     * Gets the children for this node.
     *
     * Note to inheritors: You may override this method to provide children for this node, if the node has children.
     */
    protected abstract getChildren(): Iterable<BaseNode>;

    /**
     * Finds the conceptual tree node corresponding to the provided entry.
     */
    async findNode(entry: TEntry) {
        if (this.entries.includes(entry)) {
            for (const child of await this.children) {
                if (child instanceof GroupNode) {
                    const node = await child.findNode(entry);
                    if (node) return node;
                }
            }
        }
    }
}
