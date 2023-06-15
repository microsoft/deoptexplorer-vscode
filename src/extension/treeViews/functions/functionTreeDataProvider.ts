// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from, Query } from "@esfx/iter-query";
import { UriComparer, UriEqualer } from "#core/uri.js";
import { getNullableComparer, getNullableEqualer } from "#core/utils.js";
import { formatFunctionState, FunctionState } from "#v8/enums/functionState.js";
import { ThemeIcon } from "vscode";
import type { LogFile } from "../../model/logFile";
import { formatUriMarkdown } from "../../vscode/uri";
import { BaseNodeProvider } from "../common/baseNodeProvider";
import { GroupingNode } from "../common/groupingNode";
import { FunctionNode } from "./functionNode";

const PAGE_SIZE = 500;

/**
 * A conceptual tree node provider for a log file.
 */
export class FunctionsTreeDataProvider extends BaseNodeProvider {
    private _log?: LogFile;
    private _deopts?: FunctionNode[];
    private _applyFilters = (nodes: Query<FunctionNode>) => nodes;
    private _applyGroups = (nodes: Query<FunctionNode>) => nodes
        .through(nodes => nodes
            .orderBy((e) => getFunctionStateWeight(e.state)))
        .through(nodes => GroupingNode.groupBy(nodes.toArray(), [
            GroupingNode.createGrouping({
                keySelector: node => node.file,
                keyEqualer: getNullableEqualer(UriEqualer),
                label: file => file ?? "(unknown)",
                iconPath: () => ThemeIcon.File,
                tooltip: file => file ? formatUriMarkdown(file, { as: "file", skipEncoding: true, linkSources: this.log?.sources }) : undefined,
                sorter: q => q.orderBy(g => g.key, getNullableComparer(UriComparer))
            }),
            GroupingNode.createGrouping({
                keySelector: node => node.state,
                label: state => state === undefined ? "(unknown)" : state === -1 ? "Reoptimized" : formatFunctionState(state),
                sorter: q => q.orderBy(g => getFunctionStateWeight(g.key))
            }),
        ]));

    constructor() {
        super(() => {
            if (this._log) {
                if (!this._deopts) {
                    this._deopts = from(this._log.files.values())
                        .selectMany(file => file.functions)
                        .distinct()
                        .select(func => new FunctionNode(this, /*parent*/ undefined, func))
                        .through(this._applyFilters)
                        .toArray();
                }
                return from(this._deopts)
                    .through(this._applyGroups)
                    .toArray();
            }
            return [];
        }, { pageSize: PAGE_SIZE })
    }

    get log() { return this._log; }
    set log(value) {
        if (this._log !== value) {
            this._log = value;
            this.invalidate();
        }
    }

    protected invalidate() {
        super.invalidate();
        this._deopts = undefined;
    }
}

function getFunctionStateWeight(state: FunctionState | -1) {
    switch (state) {
        case FunctionState.Interpreted: return 0;
        default:
        case FunctionState.Compiled: return 1;
        case FunctionState.CompiledSparkplug: return 2;
        case FunctionState.NativeContextIndependent: return 3;
        case FunctionState.OptimizedTurboprop: return 4;
        case FunctionState.OptimizedMaglev: return 5;
        case FunctionState.Optimized: return 6;
        case FunctionState.Inlined: return 7;
        case -1: return 8;
    }
}