// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from, Query } from "@esfx/iter-query";
import { UriComparer, UriEqualer } from "#core/uri.js";
import { getNullableComparer, getNullableEqualer } from "#core/utils.js";
import { DeoptimizeKind, DeoptimizeKindComparer, formatDeoptimizeKind } from "#v8/enums/deoptimizeKind.js";
import { SymbolKind, ThemeIcon, Uri } from "vscode";
import * as constants from "../../constants";
import { getScriptSourceUri } from "../../fileSystemProviders/scriptSourceFileSystemProvider";
import { FunctionReference } from "../../model/functionReference";
import type { LogFile } from "../../model/logFile";
import { LocationComparer } from "../../vscode/location";
import { BaseNodeProvider } from "../common/baseNodeProvider";
import { GroupingNode, GroupingOptions } from "../common/groupingNode";
import { DeoptNode } from "./deoptNode";

const PAGE_SIZE = 100;

/**
 * A conceptual tree node provider for a log file.
 */
export class DeoptTreeDataProvider extends BaseNodeProvider {
    private _groupByFile: GroupingOptions<DeoptNode, Uri | undefined> = {
        keyEqualer: getNullableEqualer(UriEqualer),

        keySelector: node => node.file,

        label: (key) => key ?? "(unknown)",

        description: (_, elements) => `${elements.length}`,

        iconPath: ThemeIcon.File,

        sorter: q =>
            this.sortBy === constants.SortDeopts.ByLocation ?
                q
                .orderBy(g => g.key, getNullableComparer(UriComparer)) :
            this.sortBy === constants.SortDeopts.ByKind ?
                q
                .orderBy(g => g.key, getNullableComparer(UriComparer)) :
            this.sortBy === constants.SortDeopts.ByCount ?
                q
                .orderByDescending(g => g.elements.length)
                .thenBy(g => g.key, getNullableComparer(UriComparer)) :
                q
    };

    private _groupByFunction: GroupingOptions<DeoptNode, FunctionReference | undefined> = {
        keyEqualer: getNullableEqualer(FunctionReference.equaler),

        keySelector: node => node.functionReference,

        label: (key) => key?.name ?? "(unknown)",

        description: (_, elements) => {
            switch (this.sortBy) {
                case constants.SortDeopts.ByKind:
                    return `${elements.length}`;
                default:
                    const worstBailoutType = from(elements).minBy(e => e.worstBailoutType)!.worstBailoutType;
                    const kind = worstBailoutType === undefined ? "unknown" : formatDeoptimizeKind(worstBailoutType, this.log?.version);
                    return `${kind} (${elements.length})`;
            }
        },

        iconPath: (key) => {
            switch (key?.symbolKind) {
                case SymbolKind.Function: return new ThemeIcon("symbol-function");
                case SymbolKind.Class: return new ThemeIcon("symbol-class");
                case SymbolKind.Namespace: return new ThemeIcon("symbol-namespace");
                case SymbolKind.Enum: return new ThemeIcon("symbol-enum");
                case SymbolKind.Method: return new ThemeIcon("symbol-method");
                case SymbolKind.Property: return new ThemeIcon("symbol-property");
                case SymbolKind.Field: return new ThemeIcon("symbol-field");
                case SymbolKind.Constructor: return new ThemeIcon("symbol-constructor");
                default: return new ThemeIcon("symbol-misc");
            }
        },

        command: (key) => {
            if (!key?.location) return;
            const uri = getScriptSourceUri(key.location.uri, this.log?.sources);
            return uri && {
                title: "",
                command: "vscode.open",
                arguments: [
                    uri,
                    {
                        preview: true,
                        selection: key.location.range
                    }
                ]
            };
        },

        sorter: (q) =>
            this.sortBy === constants.SortDeopts.ByLocation ?
                q
                .orderBy((g) => g.key?.location, getNullableComparer(LocationComparer))
                .thenByDescending((g) => g.elements.length) :
            this.sortBy === constants.SortDeopts.ByCount ?
                q
                .orderByDescending((g) => g.elements.length)
                .thenBy((g) => g.key?.location, getNullableComparer(LocationComparer)) :
            this.sortBy === constants.SortDeopts.ByKind ?
                q
                .select(g => ({ g, e: from(g.elements).minBy(e => e.worstBailoutType)! }))
                .orderBy(({ e }) => e.worstBailoutType, DeoptimizeKindComparer)
                .thenByDescending(({ g }) => g.elements.length)
                .thenBy(({ g }) => g.key?.location, getNullableComparer(LocationComparer))
                .select(({ g }) => g) :
                q,
    };

    private _groupByDeoptimizeKind: GroupingOptions<DeoptNode, DeoptimizeKind | undefined> = {
        keySelector: (node) => node.worstBailoutType,
        label: (key) => key === undefined ? "(unknown)" : formatDeoptimizeKind(key),
        description: (_, elements) => `${elements.length}`,
        sorter: q => q .orderBy(g => g.key, DeoptimizeKindComparer)
    };

    private _log?: LogFile;
    private _deopts?: DeoptNode[];
    private _groupBy = constants.kDefaultGroupDeopts;
    private _sortBy = constants.kDefaultSortDeopts;

    constructor() {
        super(() => {
            if (this._log) {
                if (!this._deopts) {
                    this._deopts = from(this._log.files.values())
                        .selectMany(file => file.deopts)
                        .distinct()
                        .select(deopt => new DeoptNode(this, /*parent*/ undefined, deopt))
                        .through(q => this._applyFilters(q))
                        .through(q => this._applyOrder(q))
                        .toArray();
                }
                return from(this._deopts)
                    .through(q => this._applyGroups(q))
                    .toArray();
            }
            return [];
        }, { pageSize: PAGE_SIZE })
    }

    get log() { return this._log; }
    set log(value) {
        if (this._log !== value) {
            this._log = value;
            this._deopts = undefined;
            this.invalidate();
        }
    }

    get groupBy() { return this._groupBy; }
    set groupBy(value) {
        if (this._groupBy !== value) {
            this._groupBy = value;
            this.invalidate();
        }
    }

    get sortBy() { return this._sortBy; }
    set sortBy(value) {
        if (this._sortBy !== value) {
            this._sortBy = value;
            this.invalidate();
        }
    }

    protected invalidate() {
        super.invalidate();
    }

    private _applyFilters(q: Query<DeoptNode>) {
        return q;
    }

    private _applyOrder(q: Query<DeoptNode>) {
        return q
            .orderBy(n => n.deopt.filePosition, getNullableComparer(LocationComparer));
    }

    private _applyGroups(q: Query<DeoptNode>) {
        switch (this.sortBy) {
            case constants.SortDeopts.ByLocation:
            case constants.SortDeopts.ByCount:
                return GroupingNode.groupBy(q.toArray(), [this._groupByFile, this._groupByFunction, this._groupByDeoptimizeKind]);
            case constants.SortDeopts.ByKind:
                return GroupingNode.groupBy(q.toArray(), [this._groupByDeoptimizeKind, this._groupByFile, this._groupByFunction]);
        }
        // const groupings: GroupingOptions<DeoptNode>[] = [];
        // if (this.sortBy === constants.SortDeopts.ByKind) {
        //     if (this.groupBy.has(constants.GroupDeopts.ByKind)) {
        //         groupings.push(this._groupByDeoptimizeKind);
        //     }
        // }
        // if (this.groupBy.has(constants.GroupDeopts.ByFile)) {
        //     groupings.push(this._groupByFile);
        // }
        // if (this.groupBy.has(constants.GroupDeopts.ByFunction)) {
        //     groupings.push(this._groupByFunction);
        // }
        // if (this.sortBy === constants.SortDeopts.ByLocation) {
        //     if (this.groupBy.has(constants.GroupDeopts.ByKind)) {
        //         groupings.push(this._groupByDeoptimizeKind);
        //     }
        // }
        // return GroupingNode.groupBy(nodes.toArray(), groupings);
    }
}