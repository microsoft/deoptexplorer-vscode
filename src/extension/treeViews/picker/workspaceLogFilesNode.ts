// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import { FileStat, ThemeIcon, TreeItemCollapsibleState, Uri, workspace } from "vscode";
import { BaseNode } from "../common/baseNode";
import { createTreeItem } from "../createTreeItem";
import { DiscoveredLogFileNode } from "./discoveredLogFileNode";
import type { PickerTreeDataProvider } from "./pickerTreeDataProvider";

/**
 * Provides a quick file picker for files discovered in the current workspace.
 */
export class WorkspaceLogFilesNode extends BaseNode {
    constructor(provider: PickerTreeDataProvider) {
        super(provider, /*parent*/ undefined);
    }

    /**
     * Gets the provider that provides this node.
     */
    get provider(): PickerTreeDataProvider { return super.provider as PickerTreeDataProvider; }

    /**
     * Gets the parent of the this node.
     */
    get parent(): undefined { return undefined; }

    protected createTreeItem() {
        return createTreeItem("Workspace", TreeItemCollapsibleState.Expanded, {
            iconPath: new ThemeIcon("folder-library"),
            contextValue: "workspaceFiles"
        });
    }

    protected async getChildren(): Promise<Iterable<BaseNode>> {
        const files = await workspace.findFiles("*v8.log", /*exclude*/ undefined, /*maxResults*/ 10);
        if (files.length === 0) {
            return [];
        }
        else {
            const stats = await Promise.all(files.map(file => Promise.resolve(workspace.fs.stat(file)).catch(() => undefined)));
            return from(files)
                .zip(stats, (file, stat) => ({ file, stat }))
                .where((entry): entry is { file: Uri, stat: FileStat } => !!entry.stat)
                .orderByDescending(({ stat }) => stat.mtime)
                .toArray(({ file, stat }) => new DiscoveredLogFileNode(this, file, stat, /*recent*/ false));
        }
    }
}
