// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable } from "@esfx/disposable";
import { ImmutableEnumSet } from "#core/collections/enumSet.js";
import { TreeView, Uri, window } from "vscode";
import * as constants from "../../constants";
import { LogFile } from "../../model/logFile";
import { groupMaps, showMaps, sortMaps } from "../../services/context";
import { BaseNode } from "../common/baseNode";
import { MapsTreeDataProvider } from "./mapsTreeDataProvider";

export class MapsTree implements Disposable {
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

    setGroupBy(value: ImmutableEnumSet<constants.GroupMaps>) {
        if (!this.provider.groupBy.equals(value)) {
            this.provider.groupBy = value;
            this.updateTreeViewHeader();
        }
    }

    setFilter(value: ImmutableEnumSet<constants.ShowMaps>) {
        if (!this.provider.filter.equals(value)) {
            this.provider.filter = value;
            this.updateTreeViewHeader();
        }
    }

    [Disposable.dispose]() {
        this.treeView.dispose();
    }

    private updateTreeViewHeader() {
        const groupByArray: string[] = ["Constructor"];
        if (this.provider.groupBy.has(constants.GroupMaps.ByFile)) groupByArray.push("File");
        if (this.provider.groupBy.has(constants.GroupMaps.ByFunction)) groupByArray.push("Function");
        const groupBy = groupByArray.join("/");

        const sortBy =
            this.provider.sortBy === constants.MapSortMode.ByCount ? `Count` :
            `Name`;

        // TODO: reverse this filter
        const filtered =
            this.provider.filter.size !== constants.kCountShowMaps ? ` (filtered)` :
            ``;

        const segments: string[] = [];
        if (groupBy) segments.push(groupBy);
        segments.push(`${sortBy}${filtered}`);

        const description = `By ${segments.join(", ")}`;
        if (this.treeView.description !== description) {
            this.treeView.description = description;
        }
    }
}