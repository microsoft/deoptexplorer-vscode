// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable } from "@esfx/disposable";
import { TreeView, Uri, window } from "vscode";
import * as constants from "../../constants";
import { LogFile } from "../../model/logFile";
import { BaseNode } from "../common/baseNode";
import { FilesTreeDataProvider } from "./filesTreeDataProvider";

/**
 * Controls how files from the log appear in the tree.
 */
export class FilesTree implements Disposable {
    private provider: FilesTreeDataProvider;
    private treeView: TreeView<BaseNode>;

    constructor() {
        this.provider = new FilesTreeDataProvider();
        this.treeView = window.createTreeView(constants.treeviews.files, { treeDataProvider: this.provider, showCollapseAll: true });
    }

    openLog(uri: Uri, log: LogFile) {
        this.provider.openLog(uri, log);
    }

    closeLog() {
        this.provider.closeLog();
    }

    [Disposable.dispose]() {
        this.treeView.dispose();
    }
}