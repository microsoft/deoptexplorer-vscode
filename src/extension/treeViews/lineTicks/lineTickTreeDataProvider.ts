// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CancellationToken } from "vscode";
import { ProfileViewNodeSnapshot } from "../../model/profileViewNodeSnapshot";
import { BaseNodeProvider } from "../common/baseNodeProvider";
import { LineTickNode } from "./lineTickNode";

export class LineTickTreeDataProvider extends BaseNodeProvider {
    private _node: ProfileViewNodeSnapshot | undefined;

    constructor() {
        super(token => this._createRoots(token));
    }

    get node() { return this._node; }
    set node(value) {
        if (this._node !== value) {
            this._node = value;
            this.invalidate();
        }
    }

    private async _createRoots(token: CancellationToken) {
        const node = this._node;
        if (!node) return [];
        let lineTicks = node.tryGetMappedLineTicks() ?? await node.getMappedLineTicksAsync(token);
        if (lineTicks.length === 0) {
            lineTicks = node.getFileLineTicks();
        }
        const log = node.log;
        const commonBase = log?.commonBaseDirectory;
        return lineTicks.map(lineTick => new LineTickNode(this, log, lineTick, commonBase));
    }
}