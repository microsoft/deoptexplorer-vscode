// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { TreeView, Uri, window } from "vscode";
import { LogFile } from "../../model/logFile";
import * as constants from "../../constants";
import { showJustMyCode, showNativeCodeProfileNodes, showNodeJsProfileNodes, showNodeModulesProfileNodes, showProfile, sortProfile } from "../../services/context";
import { BaseNode } from "../common/baseNode";
import { ProfileTreeDataProvider } from "./profileTreeDataProvider";

export class ProfileTree {
    private provider: ProfileTreeDataProvider;
    private treeView: TreeView<BaseNode>;

    constructor() {
        this.provider = new ProfileTreeDataProvider();
        this.provider.suspendUpdates();
        this.provider.sortBy = sortProfile;
        this.provider.showAs = showProfile;
        this.provider.resumeUpdates();
        this.treeView = window.createTreeView(constants.treeviews.profile, { treeDataProvider: this.provider, showCollapseAll: true });
    }

    openLog(uri: Uri, log: LogFile) {
        this.provider.suspendUpdates();
        this.provider.sortBy = sortProfile;
        this.provider.showAs = showProfile;
        this.provider.showJustMyCode = showJustMyCode;
        this.provider.showNativeCodeProfileNodes = showNativeCodeProfileNodes;
        this.provider.showNodeJsProfileNodes = showNodeJsProfileNodes;
        this.provider.showNodeModulesProfileNodes = showNodeModulesProfileNodes;
        this.provider.log = log;
        this.provider.resumeUpdates();
        this.updateTreeViewHeader();
    }

    closeLog() {
        this.provider.suspendUpdates();
        this.provider.sortBy = sortProfile;
        this.provider.showAs = showProfile;
        this.provider.showJustMyCode = showJustMyCode;
        this.provider.showNativeCodeProfileNodes = showNativeCodeProfileNodes;
        this.provider.showNodeJsProfileNodes = showNodeJsProfileNodes;
        this.provider.showNodeModulesProfileNodes = showNodeModulesProfileNodes;
        this.provider.log = undefined;
        this.provider.resumeUpdates();
        this.updateTreeViewHeader();
    }

    setSortBy(sortBy: constants.ProfileSortMode) {
        if (this.provider.sortBy !== sortBy) {
            this.provider.sortBy = sortBy;
            this.updateTreeViewHeader();
        }
    }

    setShowAs(showAs: constants.ProfileShowMode) {
        if (this.provider.showAs !== showAs) {
            this.provider.showAs = showAs;
            this.updateTreeViewHeader();
        }
    }

    setShowJustMyCode(value: boolean) {
        if (this.provider.showJustMyCode !== value) {
            this.provider.showJustMyCode = value;
            this.updateTreeViewHeader();
        }
    }

    setShowNativeCodeProfileNodes(value: boolean) {
        if (this.provider.showNativeCodeProfileNodes !== value) {
            this.provider.showNativeCodeProfileNodes = value;
            this.updateTreeViewHeader();
        }
    }

    setShowNodeJsProfileNodes(value: boolean) {
        if (this.provider.showNodeJsProfileNodes !== value) {
            this.provider.showNodeJsProfileNodes = value;
            this.updateTreeViewHeader();
        }
    }

    setShowNodeModulesProfileNodes(value: boolean) {
        if (this.provider.showNodeModulesProfileNodes !== value) {
            this.provider.showNodeModulesProfileNodes = value;
            this.updateTreeViewHeader();
        }
    }

    dispose() {
        this.treeView.dispose();
    }

    private updateTreeViewHeader() {
        let description =
            this.provider.showAs === constants.ProfileShowMode.CallTree ? "Call Tree" :
            this.provider.showAs === constants.ProfileShowMode.BottomUp ? "Bottom Up" :
            "Flat";
        description += ", ";
        description += this.provider.sortBy === constants.ProfileSortMode.BySelfTime ? "Self Time" :
            this.provider.sortBy === constants.ProfileSortMode.ByTotalTime ? "Total Time" :
            "Name";
        if (this.treeView.description !== description) {
            this.treeView.description = description;
        }
    }
}