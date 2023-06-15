// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable } from "@esfx/disposable";
import { ImmutableEnumSet } from "#core/collections/enumSet.js";
import { TreeView, Uri, window } from "vscode";
import * as constants from "../../constants";
import { LogFile } from "../../model/logFile";
import { groupDeopts, sortDeopts } from "../../services/context";
import { BaseNode } from "../common/baseNode";
import { DeoptTreeDataProvider } from "./deoptTreeDataProvider";

/**
 * Controls how files from the log appear in the tree.
 */
export class DeoptsTree implements Disposable {
    private provider: DeoptTreeDataProvider;
    private treeView: TreeView<BaseNode>;

    constructor() {
        this.provider = new DeoptTreeDataProvider();
        this.provider.groupBy = groupDeopts;
        this.provider.sortBy = sortDeopts;
        this.treeView = window.createTreeView(constants.treeviews.deopts, { treeDataProvider: this.provider, showCollapseAll: true });
    }

    openLog(uri: Uri, log: LogFile) {
        this.provider.suspendUpdates();
        this.provider.groupBy = groupDeopts;
        this.provider.sortBy = sortDeopts;
        this.provider.log = log;
        this.provider.resumeUpdates();
        this.updateTreeViewHeader();
    }

    closeLog() {
        this.provider.suspendUpdates();
        this.provider.groupBy = groupDeopts;
        this.provider.sortBy = sortDeopts;
        this.provider.log = undefined;
        this.provider.resumeUpdates();
        this.updateTreeViewHeader();
    }

    setGroupBy(value: ImmutableEnumSet<constants.GroupDeopts>) {
        if (!this.provider.groupBy.equals(value)) {
            this.provider.groupBy = value;
            this.updateTreeViewHeader();
        }
    }

    setSortBy(value: constants.SortDeopts) {
        if (this.provider.sortBy !== value) {
            this.provider.sortBy = value;
            this.updateTreeViewHeader();
        }
    }

    [Disposable.dispose]() {
        this.treeView.dispose();
    }

    private updateTreeViewHeader() {
        // const groupByArray: string[] = [];
        // if (this.provider.groupBy.has(constants.GroupDeopts.ByFile)) groupByArray.push("File");
        // if (this.provider.groupBy.has(constants.GroupDeopts.ByFunction)) groupByArray.push("Function");
        // if (this.provider.groupBy.has(constants.GroupDeopts.ByKind)) groupByArray.push("Kind");
        // const groupBy = groupByArray.join("/");
        // const sortBy =
        //     this.provider.sortBy === constants.SortDeopts.ByKind ? "Kind" :
        //     this.provider.sortBy === constants.SortDeopts.ByCount ? "Count" :
        //     "Location";
        // const description = groupBy ? `By ${groupBy}, ${sortBy}` : `By ${sortBy}`;
        const description =
            this.provider.sortBy === constants.SortDeopts.ByLocation ? `By File/Function/Kind, Location` :
            this.provider.sortBy === constants.SortDeopts.ByKind ? `By Kind/File/Function, Kind` :
            this.provider.sortBy === constants.SortDeopts.ByCount ? `By File/Function/Kind, Count` :
            "";

        if (this.treeView.description !== description) {
            this.treeView.description = description;
        }
    }
}