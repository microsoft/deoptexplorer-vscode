// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable } from "@esfx/disposable";
import { TreeView, Uri, window } from "vscode";
import * as constants from "../../constants";
import { LogFile } from "../../model/logFile";
import { BaseNode } from "../common/baseNode";
import { FunctionsTreeDataProvider } from "./functionTreeDataProvider";

/**
 * Controls how files from the log appear in the tree.
 */
export class FunctionsTree implements Disposable {
    private provider: FunctionsTreeDataProvider;
    private treeView: TreeView<BaseNode>;

    constructor() {
        this.provider = new FunctionsTreeDataProvider();
        this.treeView = window.createTreeView(constants.treeviews.functions, { treeDataProvider: this.provider, showCollapseAll: true });
    }

    openLog(uri: Uri, log: LogFile) {
        this.provider.suspendUpdates();
        this.provider.log = log;
        this.provider.resumeUpdates();
        this.updateTreeViewHeader();
    }

    closeLog() {
        this.provider.suspendUpdates();
        this.provider.log = undefined;
        this.provider.resumeUpdates();
        this.updateTreeViewHeader();
    }

    [Disposable.dispose]() {
        this.treeView.dispose();
    }

    private updateTreeViewHeader() {
    }
}