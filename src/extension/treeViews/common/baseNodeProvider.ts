// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { toArrayAsync } from "@esfx/async-iter-fn";
import { CancellationToken, CancellationTokenSource, EventEmitter, ProviderResult, TreeDataProvider, TreeItem } from "vscode";
import { isAsyncIterable, isPromise } from "../../utils/types";
import { paginateNodes, PaginationOptions } from "../pagination";
import type { BaseNode } from "./baseNode";

export type RootNodeFactory = (token: CancellationToken) => Iterable<BaseNode> | Promise<Iterable<BaseNode>> | AsyncIterable<BaseNode>;

/**
 * An abstract base class providing conceptual tree nodes to produce a visual tree.
 */
export abstract class BaseNodeProvider implements TreeDataProvider<BaseNode> {
    private _roots?: RootNodeFactory | BaseNode[];
    private _resolvedRoots?: Promise<BaseNode[]> | BaseNode[];
    private _onDidChangeTreeDataEvent = new EventEmitter<BaseNode | null | undefined>();
    private _updatesSuspended = 0;
    private _updateRequested = false;
    private _cancelSource: CancellationTokenSource | undefined;
    private _paginationOptions?: PaginationOptions;

    /**
     * @implements {TreeDataProvider<BaseNode>.onDidChangeTreeData}
     */
    readonly onDidChangeTreeData = this._onDidChangeTreeDataEvent.event;

    constructor(roots?: RootNodeFactory | BaseNode[], paginationOptions?: PaginationOptions) {
        this._roots = roots;
        this._paginationOptions = paginationOptions;
    }

    /**
     * Gets the root nodes of the tree.
     */
    get rootNodes() {
        return this._ensureRoots();
    }

    /**
     * Suspends visual updates to the tree. Calls to `suspendUpdates` and `resumeUpdates` must be balanced.
     */
    suspendUpdates() {
        this._updatesSuspended++;
    }

    /**
     * Resumes visual updates to the tree. If an update was requested while visual updates were suspended, it
     * will be triggered when all suspensions are resumed. Calls to `suspendUpdates` and `resumeUpdates` must
     * be balanced.
     */
    resumeUpdates() {
        if (this._updatesSuspended) {
            this._updatesSuspended--;
            if (this._updatesSuspended === 0) {
                if (this._updateRequested) {
                    this._updateRequested = false;
                    this._onDidChangeTreeDataEvent.fire(undefined);
                }
            }
        }
    }

    /**
     * Gets the visual `TreeItem` for a conceptual tree node.
     * @param element The conceptual tree node.
     * @implements {TreeDataProvider<BaseNode>.getTreeItem}
     */
    getTreeItem(element: BaseNode): TreeItem | Thenable<TreeItem> {
        return element.treeItem;
    }

    /**
     * Gets the conceptual tree node children of a parent element, or the root nodes if `element` is undefined.
     * @param element The conceptual tree node.
     * @implements {TreeDataProvider<BaseNode>.getChildren}
     */
    getChildren(element?: BaseNode | undefined): ProviderResult<BaseNode[]> {
        if (element) return element.children;
        return this._ensureRoots();
    }

    /**
     * Gets the visual or conceptual parent of an conceptual tree node.
     * @param element The conceptual tree node.
     * @returns The visual parent of the node, if present; otherwise, the conceptual parent of the node.
     * @implements {TreeDataProvider<BaseNode>.getParent}
     */
    getParent(element: BaseNode) {
        return element.visualParent ?? element.parent;
    }

    /**
     * Resolves missing properties for a tree item.
     * @implements {TreeDataProvider<BaseNode>.resolveTreeItem}
     */
    resolveTreeItem(item: TreeItem, element: BaseNode, token: CancellationToken): ProviderResult<TreeItem> {
        return element.resolveTreeItem(item, token);
    }

    /**
     * Provides an opportunity for the provider to handle a context command that was unhandled by a base node.
     * @param commandName The name of the command.
     * @param node The node that initially received the command.
     */
    onUnhandledCommand(commandName: string, node: BaseNode): ProviderResult<void> {
    }

    /**
     * Sets the conceptual root nodes (or a callback used to create the root nodes) of the tree.
     */
    protected setRoots(roots: RootNodeFactory | BaseNode[] | undefined) {
        if (this._roots !== roots) {
            this._roots = roots;
            this.invalidate();
        }
    }

    /**
     * Invalidates the tree, triggering a visual refresh.
     */
    protected invalidate() {
        this._resolvedRoots = undefined;
        this._cancelSource?.cancel();
        this._cancelSource = undefined;
        if (this._updatesSuspended) {
            this._updateRequested = true;
        }
        else {
            this._onDidChangeTreeDataEvent.fire(undefined);
        }
    }

    private _ensureRoots() {
        if (!this._resolvedRoots && this._roots) {
            const roots = typeof this._roots === "function" ? this._startEnsureRoots(this._roots) : this._roots;
            this._resolvedRoots = isPromise(roots) ? roots.then(roots => this._finishEnsureRoots(roots)) : this._finishEnsureRoots(roots);
        }
        return this._resolvedRoots;
    }

    private _startEnsureRoots(factory: RootNodeFactory) {
        this._cancelSource?.cancel();
        this._cancelSource = new CancellationTokenSource();
        const result = factory(this._cancelSource.token);
        return isAsyncIterable(result) ? toArrayAsync(result) : result;
    }

    private _finishEnsureRoots(roots: Iterable<BaseNode> | BaseNode[]) {
        this._resolvedRoots = paginateNodes(Array.isArray(roots) ? roots : [...roots], this, /*paginationParent*/ undefined, this._paginationOptions);
        this._cancelSource?.dispose();
        this._cancelSource = undefined;
        return this._resolvedRoots;
    }
}
