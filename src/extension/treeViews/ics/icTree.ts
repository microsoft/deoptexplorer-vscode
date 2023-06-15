// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable } from "@esfx/disposable";
import { ImmutableEnumSet } from "#core/collections/enumSet.js";
import { TreeView, Uri, window } from "vscode";
import * as constants from "../../constants";
import { LogFile } from "../../model/logFile";
import { showICStates, sortICs } from "../../services/context";
import { BaseNode } from "../common/baseNode";
import { IcTreeDataProvider } from "./icTreeDataProvider";

/**
 * Controls how files from the log appear in the tree.
 */
export class IcsTree implements Disposable {
    private provider: IcTreeDataProvider;
    private treeView: TreeView<BaseNode>;

    constructor() {
        this.provider = new IcTreeDataProvider();
        this.provider.suspendUpdates();
        this.provider.sortBy = sortICs;
        this.provider.showICStates = showICStates;
        this.provider.resumeUpdates();
        this.treeView = window.createTreeView(constants.treeviews.ics, { treeDataProvider: this.provider, showCollapseAll: true });
    }

    openLog(uri: Uri, log: LogFile) {
        this.provider.suspendUpdates();
        this.provider.sortBy = sortICs;
        this.provider.showICStates = showICStates;
        this.provider.log = log;
        this.provider.resumeUpdates();
        this.updateTreeViewHeader();
    }

    closeLog() {
        this.provider.suspendUpdates();
        this.provider.sortBy = sortICs;
        this.provider.showICStates = showICStates;
        this.provider.log = undefined;
        this.provider.resumeUpdates();
        this.updateTreeViewHeader();
    }

    setSortBy(value: constants.SortICs) {
        if (this.provider.sortBy !== value) {
            this.provider.sortBy = value;
            this.updateTreeViewHeader();
        }
    }

    setShowICStates(value: ImmutableEnumSet<constants.ShowICStates>) {
        if (!this.provider.showICStates.equals(value)) {
            this.provider.showICStates = value;
            this.updateTreeViewHeader();
        }
    }

    [Disposable.dispose]() {
        this.treeView.dispose();
    }

    private updateTreeViewHeader() {
        const sortBy =
            this.provider.sortBy === constants.SortICs.ByLocation ? `By File/Function/State, Location` :
            this.provider.sortBy === constants.SortICs.ByState ? `By State/File/Function, State` :
            // this.provider.sortBy === constants.SortICs.ByCount ? `By File/Function/Kind, Count` :
            "";

        const filtered =
            this.provider.showICStates.size > 0 &&
            this.provider.showICStates.size < constants.kCountShowICStates ? ` (filtered)` :
            ``;

        const description = `${sortBy}${filtered}`;
        if (this.treeView.description !== description) {
            this.treeView.description = description;
        }
    }
}