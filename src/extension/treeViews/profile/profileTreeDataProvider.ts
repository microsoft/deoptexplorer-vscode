// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from, Query } from "@esfx/iter-query";
import { compareNullable } from "#core/utils.js";
import { CodeEntry } from "#v8/tools/codeentry.js";
import { ProfileViewNode } from "#v8/tools/profile_view.js";
import * as constants from "../../constants";
import { FunctionNameComparer } from "../../model/functionName";
import type { LogFile } from "../../model/logFile";
import { LocationComparer } from "../../vscode/location";
import { BaseNodeProvider } from "../common/baseNodeProvider";
import { ProfileNode } from "./profileNode";

const PROFILE_PAGE_SIZE = 750;

export class ProfileTreeDataProvider extends BaseNodeProvider {
    private _sortBy = constants.kDefaultProfileSortMode;
    private _showAs = constants.kDefaultProfileShowMode;
    private _showJustMyCode = constants.kDefaultShowJustMyCode;
    private _showNativeCodeProfileNodes = constants.kDefaultShowNativeCodeProfileNodes;
    private _showNodeJsProfileNodes = constants.kDefaultShowNodeJsProfileNodes;
    private _showNodeModulesProfileNodes = constants.kDefaultShowNodeModulesProfileNodes;
    private _log?: LogFile;
    private _head?: ProfileViewNode;

    constructor() {
        super(() => {
            if (this._log) {
                if (!this._head) {
                    const view = this._log.profile.getProfileView(this._showAs, {
                        hideNativeCode: this._showJustMyCode || !this._showNativeCodeProfileNodes,
                        hideNodeJsCode: this._showJustMyCode || !this._showNodeJsProfileNodes,
                        hideNodeModulesCode: this._showJustMyCode || !this._showNodeModulesProfileNodes,
                    });
                    this._head = view.head;
                }
                return this.applySort(this._head.children);
            }
            return [];
        }, {
            pageSize: PROFILE_PAGE_SIZE
        });
    }

    get sortBy() { return this._sortBy; }
    set sortBy(value) {
        if (this._sortBy !== value) {
            this._sortBy = value;
            this.invalidate();
        }
    }

    get showAs() { return this._showAs; }
    set showAs(value) {
        if (this._showAs !== value) {
            this._showAs = value;
            this._head = undefined;
            this.invalidate();
        }
    }

    get showJustMyCode() { return this._showJustMyCode; }
    set showJustMyCode(value) {
        if (this._showJustMyCode !== value) {
            this._showJustMyCode = value;
            this._head = undefined;
            this.invalidate();
        }
    }

    get showNativeCodeProfileNodes() { return this._showNativeCodeProfileNodes; }
    set showNativeCodeProfileNodes(value) {
        if (this._showNativeCodeProfileNodes !== value) {
            this._showNativeCodeProfileNodes = value;
            this._head = undefined;
            this.invalidate();
        }
    }

    get showNodeJsProfileNodes() { return this._showNodeJsProfileNodes; }
    set showNodeJsProfileNodes(value) {
        if (this._showNodeJsProfileNodes !== value) {
            this._showNodeJsProfileNodes = value;
            this._head = undefined;
            this.invalidate();
        }
    }

    get showNodeModulesProfileNodes() { return this._showNodeModulesProfileNodes; }
    set showNodeModulesProfileNodes(value) {
        if (this._showNodeModulesProfileNodes !== value) {
            this._showNodeModulesProfileNodes = value;
            this._head = undefined;
            this.invalidate();
        }
    }

    get log() { return this._log; }
    set log(value) {
        if (this._log !== value) {
            this._log = value;
            this._head = undefined;
            this.invalidate();
        }
    }

    applySort(nodes: ProfileViewNode[]) {
        return from(nodes)
            .through(ProfileTreeDataProvider._getSorter(this._sortBy))
            .toArray(node => new ProfileNode(this, node, node instanceof HiddenProfileNode ? node.hiddenNodes : undefined));
    }

    private static _getSorter(sortBy: constants.ProfileSortMode): (query: Query<ProfileViewNode>) => Iterable<ProfileViewNode> {
        switch (sortBy) {
            case constants.ProfileSortMode.BySelfTime: return this._bySelfTimeSorter;
            case constants.ProfileSortMode.ByTotalTime: return this._byTotalTimeSorter;
            case constants.ProfileSortMode.ByName: return this._byNameSorter;
        }
    }

    private static _bySelfTimeSorter(query: Query<ProfileViewNode>): Iterable<ProfileViewNode> {
        return query
            .orderByDescending(node => node.selfTime)
            .thenBy(({ functionName }) => functionName, FunctionNameComparer.compare);
    }

    private static _byTotalTimeSorter(query: Query<ProfileViewNode>): Iterable<ProfileViewNode> {
        return query
            .orderByDescending(node => node.totalTime)
            .thenBy(({ functionName }) => functionName, FunctionNameComparer.compare);
    }

    private static _byNameSorter(query: Query<ProfileViewNode>): Iterable<ProfileViewNode> {
        return query
            .orderBy(({ functionName }) => functionName.name)
            .thenBy(({ functionName }) => functionName.filePosition, (x, y) => compareNullable(x, y, LocationComparer));
    }
}

class HiddenProfileNode extends ProfileViewNode {
    private _visibleChildren: ProfileViewNode[];
    readonly hiddenNodes: readonly ProfileViewNode[];
    constructor(node: ProfileViewNode, shouldHide: (node: ProfileViewNode) => boolean) {
        let selfTime = 0;
        let children: ProfileViewNode[] = [];
        let hidden: ProfileViewNode[] = [];
        const flatten = (node: ProfileViewNode) => {
            if (node instanceof HiddenProfileNode || shouldHide(node)) {
                selfTime += node.selfTime;
                hidden.push(node);
                for (const child of node.children) {
                    flatten(child);
                }
            }
            else {
                children.push(node);
            }
        };
        flatten(node);
        super(CodeEntry.hidden_entry(), node.totalTime, selfTime);
        this._visibleChildren = children;
        this.hiddenNodes = hidden;
    }

    static maybeHide(node: ProfileViewNode, shouldHide: (node: ProfileViewNode) => boolean) {
        return shouldHide(node) ? new HiddenProfileNode(node, shouldHide) : node;
    }

    get children() {
        return this._visibleChildren;
    }
}
