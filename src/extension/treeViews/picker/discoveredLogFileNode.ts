// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { UriEqualer } from "#core/uri.js";
import { format } from "timeago.js";
import { FileStat, ThemeIcon, TreeItemCollapsibleState, Uri } from "vscode";
import * as constants from "../../constants";
import { emitters } from "../../services/events";
import * as storage from "../../services/storage";
import { BaseNode } from "../common/baseNode";
import { createTreeItem } from "../createTreeItem";
import type { PickerTreeDataProvider } from "./pickerTreeDataProvider";
import type { RecentLogFilesNode } from "./recentLogFilesNode";
import type { WorkspaceLogFilesNode } from "./workspaceLogFilesNode";

/**
 * Represents a discovered (but not opened) log file.
 */
export class DiscoveredLogFileNode extends BaseNode {
    constructor(
        parent: RecentLogFilesNode | WorkspaceLogFilesNode,
        readonly uri: Uri,
        readonly stat: FileStat,
        readonly recent: boolean,
    ) {
        super(parent.provider, parent);
    }

    /**
     * Gets the provider that provides this node.
     */
    get provider(): PickerTreeDataProvider { return super.provider as PickerTreeDataProvider; }

    /**
     * Gets the parent of the this node.
     */
    get parent(): RecentLogFilesNode | WorkspaceLogFilesNode { return super.parent as RecentLogFilesNode | WorkspaceLogFilesNode; }

    protected createTreeItem() {
        return createTreeItem(this.uri, TreeItemCollapsibleState.None, {
            command: {
                title: "",
                command: constants.commands.log.open,
                arguments: [this.uri]
            },
            contextValue: this.recent ? "logFile+recent" : "logFile",
            iconPath: ThemeIcon.File,
            description: format(this.stat.mtime)
        });
    }

    async onCommand(commandName: string) {
        if (commandName === constants.commands.log.removeRecent && this.recent) {
            const recent = storage.getRecentFiles();
            const filtered = recent.filter(it => !UriEqualer.equals(it, this.uri));
            if (filtered.length !== recent.length) {
                emitters.willChangeRecentLogs();
                await storage.setRecentFiles(filtered);
                emitters.didChangeRecentLogs();
            }
            return;
        }
        return super.onCommand(commandName);
    }
}
