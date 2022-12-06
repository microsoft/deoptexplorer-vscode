// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Location, Position, TextDocumentShowOptions, TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import { uriBasename } from "../../../core/uri";
import { LogFile } from "../../model/logFile";
import { FileLineTick } from "../../../third-party-derived/v8/tools/types";
import { formatMilliseconds } from "../../formatting/numbers";
import { openedLog } from "../../services/currentLogFile";
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
        const relative = this.log?.tryGetRelativeUriFragment(this.lineTick.file) ?? uriBasename(this.lineTick.file);

        // NOTE: LineTick.line is 1-based, Position is 0-based.
        const location = new Location(this.lineTick.file, new Position(this.lineTick.line - 1, 0));
        const avgDuration = openedLog?.profile.averageSampleDuration.inMillisecondsF() ?? 0;
        const parentTime = this.provider.node?.selfTime ?? 1;
        const selfTime = this.lineTick.hitCount * avgDuration;
        const selfPercent = selfTime * 100 / parentTime;
        return createTreeItem(this.lineTick.file, TreeItemCollapsibleState.None, {
            label: `${relative}:${this.lineTick.line}`,
            description: `${formatMilliseconds(selfTime)} (${selfPercent.toFixed(1)}%)`,
            command: {
                title: "open",
                command: "vscode.open",
                arguments: [location.uri, { preview: true, selection: location.range } as TextDocumentShowOptions]
            }
        });
    }
}