// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { empty } from "@esfx/iter-fn";
import { assert } from "#core/assert.js";
import { CancellationToken, ProviderResult, TreeItem } from "vscode";
import { ContextCommandHandler } from "../../commands";
import { paginateNodes, PaginationOptions } from "../pagination";
import type { BaseNodeProvider } from "./baseNodeProvider";

/**
 * Abstract class representing the conceptual base node for a `TreeItem` visual.
 */
export abstract class BaseNode extends ContextCommandHandler {
    private _treeItem?: TreeItem;
    private _parent: BaseNode | undefined;
    private _provider: BaseNodeProvider;
    private _visualParent?: BaseNode;
    private _children?: Promise<BaseNode[]>;

    constructor(
        provider: BaseNodeProvider,
        parent: BaseNode | undefined,
        private paginationOptions?: PaginationOptions
    ) {
        super();
        if (parent) assert(parent.provider === provider);
        this._provider = provider;
        this._parent = parent;
    }

    /**
     * The provider that provides this node.
     */
    get provider(): BaseNodeProvider { return this._provider; }

    /**
     * The conceptual parent of this node.
     */
    get parent(): BaseNode | undefined { return this._parent; }

    /**
     * The visual parent node for this node. The visual parent usually only differs from the parent if the node is paged.
     */
    get visualParent(): BaseNode | undefined { return this._visualParent; }

    /**
     * Gets the `TreeItem` for this node.
     */
    get treeItem(): TreeItem { return this.ensureTreeItem(); }

    /**
     * Gets the children (or a Promise for the children) of this node.
     */
    get children(): BaseNode[] | Promise<BaseNode[]> { return this.ensureChildren(); }

    /**
     * Invalidates the node, clearing its children and `TreeItem`.
     */
    invalidate() {
        this._children = undefined;
        this._treeItem = undefined;
    }

    /**
     * Ensures and returns the `TreeItem` for this node.
     */
    ensureTreeItem() {
        return this._treeItem ?? this.createTreeItem();
    }

    /**
     * Ensures and returns the children (or a `Promise` for the children) of this node.
     */
    ensureChildren(): BaseNode[] | Promise<BaseNode[]> {
        return this._children ??= Promise.resolve(this.getChildren()).then(children => this.paginateChildren([...children]));
    }

    onCommand(commandName: string): ProviderResult<void> {
        return this.provider.onUnhandledCommand(commandName, this);
    }

    /**
     * Creates the `TreeItem` to display for this node.
     *
     * Note to inheritors: You must override this method to provide the `TreeItem` visual for this node.
     */
    protected abstract createTreeItem(): TreeItem;

    /**
     * Resolves missing properties for the `TreeItem` to display for this node.
     */
    resolveTreeItem(treeItem: TreeItem, token: CancellationToken): ProviderResult<TreeItem> {
        return treeItem;
    }

    /**
     * Gets the children for this node.
     * 
     * Note to inheritors: You may override this method to provide children for this node, if the node has children.
     * @returns
     */
    protected getChildren(): Iterable<BaseNode> | Promise<Iterable<BaseNode>> {
        return empty<never>();
    }

    private paginateChildren(children: BaseNode[]): BaseNode[] {
        return paginateNodes(children, this.provider, this, this.paginationOptions);
    }
}
