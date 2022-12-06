// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable, FileSystemWatcher, RelativePattern, workspace, WorkspaceFolder } from "vscode";
import { PickerTreeDataProvider } from "./pickerTreeDataProvider";

export class WorkspaceWatcher {
    private watching = false;
    private watchers = new Map<string, FileSystemWatcher>();
    private workspaceFoldersChangedSubscription?: Disposable

    constructor(
        readonly provider: PickerTreeDataProvider
    ) {}

    startWatching() {
        if (this.watching) return;
        if (workspace.workspaceFolders) {
            for (const workspaceFolder of workspace.workspaceFolders) {
                this.watchFolder(workspaceFolder);
            }
        }
        this.workspaceFoldersChangedSubscription?.dispose();
        this.workspaceFoldersChangedSubscription = workspace.onDidChangeWorkspaceFolders((e) => {
            this.provider.invalidate();
            for (const workspaceFolder of e.added) {
                this.watchFolder(workspaceFolder);
            }
            for (const workspaceFolder of e.removed) {
                this.unwatchFolder(workspaceFolder);
            }
        });
    }

    stopWatching() {
        if (!this.watching) return;
        for (const watcher of this.watchers.values()) {
            watcher.dispose();
        }
        this.watchers.clear();
        this.workspaceFoldersChangedSubscription?.dispose();
        this.workspaceFoldersChangedSubscription = undefined;
    }

    dispose() {
        this.stopWatching();
    }

    private watchFolder(workspaceFolder: WorkspaceFolder) {
        const key = workspaceFolder.uri.toString();
        if (this.watchers.has(key)) return;
        const watcher = workspace.createFileSystemWatcher(new RelativePattern(workspaceFolder, `*v8.log`));
        watcher.onDidChange(() => { this.provider.invalidate(); });
        watcher.onDidCreate(() => { this.provider.invalidate(); });
        watcher.onDidDelete(() => { this.provider.invalidate(); });
        this.watchers.set(key, watcher);
    }

    private unwatchFolder(workspaceFolder: WorkspaceFolder) {
        const key = workspaceFolder.uri.toString();
        const watcher = this.watchers.get(key);
        if (watcher) {
            watcher.dispose();
            this.watchers.delete(key);
        }
    }
}