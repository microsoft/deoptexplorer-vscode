// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import { FileStat, ThemeIcon, TreeItemCollapsibleState, Uri, workspace } from "vscode";
import * as storage from "../../services/storage";
import { BaseNode } from "../common/baseNode";
import { createTreeItem } from "../createTreeItem";
import { DiscoveredLogFileNode } from "./discoveredLogFileNode";
import type { PickerTreeDataProvider } from "./pickerTreeDataProvider";

/**
 * Provides a quick file picker for recently opened logs.
 */
export class RecentLogFilesNode extends BaseNode {
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
        return createTreeItem("Recent", TreeItemCollapsibleState.Expanded, {
            iconPath: new ThemeIcon("history")
        });
    }

    protected async getChildren(): Promise<Iterable<BaseNode>> {
        const recentFiles = storage.getRecentFiles();
        if (recentFiles.length === 0) {
            return [];
        }
        else {
            const stats = await Promise.all(recentFiles.map(file => Promise.resolve(workspace.fs.stat(file)).catch(() => undefined)));
            return from(recentFiles)
                .zip(stats, (file, stat) => ({ file, stat }))
                .where((entry): entry is { file: Uri, stat: FileStat } => !!entry.stat)
                .toArray(({ file, stat }) => new DiscoveredLogFileNode(this, file, stat, /*recent*/ true));
        }
    }
}
