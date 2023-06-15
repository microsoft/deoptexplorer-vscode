// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { FileLineTick } from "#v8/tools/types.js";
import { TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import { getScriptSourceUri } from "../../fileSystemProviders/scriptSourceFileSystemProvider";
import { formatMilliseconds } from "../../formatting/numbers";
import { LogFile } from "../../model/logFile";
import { openedLog } from "../../services/currentLogFile";
import { formatLocation } from "../../vscode/location";
import { BaseNode } from "../common/baseNode";
import { createTreeItem } from "../createTreeItem";
import { LineTickTreeDataProvider } from "./lineTickTreeDataProvider";

export class LineTickNode extends BaseNode {
    constructor(
        provider: LineTickTreeDataProvider,
        readonly log: LogFile | undefined,
        readonly lineTick: FileLineTick,
        readonly base: Uri | undefined
    ) {
        super(provider, /*parent*/ undefined);
    }

    get provider(): LineTickTreeDataProvider { return super.provider as LineTickTreeDataProvider; }

    protected createTreeItem(): TreeItem {
        const location = this.lineTick.toLocation();
        const relativeTo = this.log && { log: this.log, ignoreIfBasename: true };
        const relative = formatLocation(location, { as: "file", include: "line", skipEncoding: true, relativeTo });
        const avgDuration = openedLog?.profile.averageSampleDuration.inMillisecondsF() ?? 0;
        const parentTime = this.provider.node?.selfTime ?? 1;
        const selfTime = this.lineTick.hitCount * avgDuration;
        const selfPercent = selfTime * 100 / parentTime;
        const uri = getScriptSourceUri(location.uri, openedLog?.sources);
        return createTreeItem(this.lineTick.file, TreeItemCollapsibleState.None, {
            label: `${relative}:${this.lineTick.line}`,
            description: `${formatMilliseconds(selfTime)} (${selfPercent.toFixed(1)}%)`,
            command: uri && {
                title: "open",
                command: "vscode.open",
                arguments: [uri, { preview: true, selection: location.range }]
            }
        });
    }
}