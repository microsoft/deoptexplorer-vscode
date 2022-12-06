// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { TreeView, Uri, window } from "vscode";
import { LogFile } from "../../model/logFile";
import * as constants from "../../constants";
import { groupMaps, showMaps, sortMaps } from "../../services/context";
import { BaseNode } from "../common/baseNode";
import { MapsTreeDataProvider } from "./mapsTreeDataProvider";

export class MapsTree {
    private provider: MapsTreeDataProvider;
    private treeView: TreeView<BaseNode>;

    constructor() {
        this.provider = new MapsTreeDataProvider();
        this.provider.suspendUpdates();
        this.provider.sortBy = sortMaps;
        this.provider.filter = showMaps;
        this.provider.groupBy = groupMaps;
        this.provider.resumeUpdates();
        this.treeView = window.createTreeView(constants.treeviews.maps, { treeDataProvider: this.provider, showCollapseAll: true });
    }

    openLog(uri: Uri, log: LogFile) {
        this.provider.suspendUpdates();
        this.provider.sortBy = sortMaps;
        this.provider.filter = showMaps;
        this.provider.groupBy = groupMaps;
        this.provider.log = log;
        this.provider.resumeUpdates();
        this.updateTreeViewHeader();
    }

    closeLog() {
        this.provider.suspendUpdates();
        this.provider.sortBy = sortMaps;
        this.provider.filter = showMaps;
        this.provider.groupBy = groupMaps;
        this.provider.log = undefined;
        this.provider.resumeUpdates();
        this.updateTreeViewHeader();
    }

    setSortBy(value: constants.MapSortMode) {
        if (this.provider.sortBy !== value) {
            this.provider.sortBy = value;
            this.updateTreeViewHeader();
        }
    }

    setGroupBy(value: readonly constants.GroupMaps[]) {
        if (this.provider.groupBy !== value) {
            this.provider.groupBy = value;
            this.updateTreeViewHeader();
        }
    }

    setFilter(value: readonly constants.ShowMaps[]) {
        if (this.provider.filter !== value) {
            this.provider.filter = value;
            this.updateTreeViewHeader();
        }
    }

    dispose() {
        this.treeView.dispose();
    }

    private updateTreeViewHeader() {
        const groupByFile = this.provider.groupBy.includes(constants.GroupMaps.ByFile);
        const groupByFunction = this.provider.groupBy.includes(constants.GroupMaps.ByFunction);
        const groupBy =
            groupByFile && groupByFunction ? `Constructor/File/Function` :
            groupByFile ? `Constructor/File` :
            groupByFile ? `Constructor/Function` :
            `Constructor`;

        const sortBy =
            this.provider.sortBy === constants.MapSortMode.ByCount ? `Count` :
            `Name`;

        const filtered =
            this.provider.filter.length !== 3 ? ` (filtered)` :
            ``;

        const description = `By ${groupBy}, ${sortBy}${filtered}`;
        if (this.treeView.description !== description) {
            this.treeView.description = description;
        }
    }
}