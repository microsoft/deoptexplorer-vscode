// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { identity } from "@esfx/fn";
import { from, Query } from "@esfx/iter-query";
import { markdown, MarkdownString } from "#core/markdown.js";
import { UriComparer, UriEqualer } from "#core/uri.js";
import { getNullableComparer, getNullableEqualer } from "#core/utils.js";
import { formatIcState, IcState } from "#v8/enums/icState.js";
import { SymbolKind, ThemeColor, ThemeIcon, Uri } from "vscode";
import * as constants from "../../constants";
import { getScriptSourceUri } from "../../fileSystemProviders/scriptSourceFileSystemProvider";
import { FunctionReference } from "../../model/functionReference";
import type { LogFile } from "../../model/logFile";
import { formatLocationMarkdown } from "../../vscode/location";
import { formatUriMarkdown } from "../../vscode/uri";
import { BaseNodeProvider } from "../common/baseNodeProvider";
import { GroupingNode, GroupingOptions } from "../common/groupingNode";
import { IcNode } from "./icNode";

const PAGE_SIZE = 500;

/**
 * A conceptual tree node provider for a log file.
 */
export class IcTreeDataProvider extends BaseNodeProvider {
    private _summarizeStates(elements: readonly IcNode[]) {
        const worstState =
            from(elements)
            .select(n => n.state)
            .max() ?? IcState.NO_FEEDBACK;

        const hitCount =
            from(elements)
            .sum(n => n.hitCount);

        return `${hitCount}, ${formatIcState(worstState)}`;
    }

    private _summarizeHitCount(elements: readonly IcNode[], state?: IcState) {
        const count = from(elements)
            .selectMany(n => n.ic.updates)
            .select(u => u.newState)
            .through(state === undefined ? identity : q => q.where(s => s === state))
            .count();

        return `${count}`;
    }

    private _groupByFile: GroupingOptions<IcNode, Uri | undefined, GroupingNode<IcNode, IcState> | undefined> = {
        context: (_, parent) => {
            if (parent?.groupingOptions === this._groupByState) {
                return parent;
            }
        },

        keyEqualer: getNullableEqualer(UriEqualer),

        keySelector: (node) => node.file,

        iconPath: ThemeIcon.File,

        label: (key) => key ?? "(unknown)",

        description: (_, elements, parent) =>
            this.sortBy === constants.SortICs.ByLocation ? this._summarizeStates(elements) :
                this._summarizeHitCount(elements, parent?.key),

        tooltip: (key, elements, parent) => {
            const lines: MarkdownString[] = [];

            const hitCount =
                this.sortBy === constants.SortICs.ByLocation ?
                    from(elements)
                    .sum(n => n.hitCount) :
                    from(elements)
                    .selectMany(n => n.ic.updates)
                    .select(u => u.newState)
                    .through(parent === undefined ? identity : q => q.where(s => s === parent.key))
                    .count();

            lines.push(markdown.trusted`**hit count:** ${hitCount}  \n`);

            const worstState =
                from(elements)
                .select(n => n.state)
                .max() ?? IcState.NO_FEEDBACK;

            lines.push(markdown.trusted`**worst state:** ${formatIcState(worstState)}  \n`);

            return markdown.trusted`${formatUriMarkdown(key, { as: "file", skipEncoding: true, linkSources: this.log?.sources, trusted: true })}\n\n${lines}`;
        },

        sorter: (q) =>
            q.orderBy(g => g.key, getNullableComparer(UriComparer))
    };

    private _groupByFunction: GroupingOptions<IcNode, FunctionReference | undefined, GroupingNode<IcNode, IcState> | undefined> = {

        context: (_, parent) =>
            parent?.groupingOptions === this._groupByFile &&
            parent.parent instanceof GroupingNode && parent.parent.groupingOptions === this._groupByState ? parent.parent :
                undefined,

        keyEqualer: getNullableEqualer(FunctionReference.equaler),

        keySelector: (node) => node.functionReference,

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

        label: (key) => key?.name ?? "(no function)",

        description: (_, elements, grandparent) =>
            this.sortBy === constants.SortICs.ByLocation ? this._summarizeStates(elements) :
                this._summarizeHitCount(elements, grandparent?.key),

        tooltip: (key, elements, grandparent) => {
            if (key) {
                const lines: MarkdownString[] = [];
                const relativeTo = this.log && { log: this.log, ignoreIfBasename: true };
                lines.push(markdown`**file:** ${formatLocationMarkdown(key.location, { as: "file", relativeTo, include: "position", skipEncoding: true, linkSources: this.log?.sources })}  \n`);

                const hitCount =
                    this.sortBy === constants.SortICs.ByLocation ?
                        from(elements)
                        .sum(n => n.hitCount) :
                        from(elements)
                        .selectMany(n => n.ic.updates)
                        .select(u => u.newState)
                        .through(grandparent === undefined ? identity : q => q.where(s => s === grandparent.key))
                        .count();

                lines.push(markdown`**hit count:** ${hitCount}  \n`);

                const worstState =
                    from(elements)
                    .select(n => n.state)
                    .max() ?? IcState.NO_FEEDBACK;

                lines.push(markdown`**worst state:** ${formatIcState(worstState)}  \n`);

                return markdown`${key.name}\n\n${lines}`;
            }
        },

        command: (key) => {
            if (!key?.location || this.log?.generatedPaths.has(key.location.uri)) return;

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
            q
            .select(g => ({ g, e: from(g.elements).maxBy(e => e.state)! }))
            .orderByDescending(({ e }) => e.state)
            .thenByDescending(({ e }) => e.hitCount)
            .select(({ g }) => g),
    };

    private _groupByState: GroupingOptions<IcNode, IcState> = {
        keySelector: node => node.state,

        label: (key) => formatIcState(key),

        description: (key, elements) =>
            this.sortBy === constants.SortICs.ByLocation ? this._summarizeHitCount(elements) :
            this._summarizeHitCount(elements, key),

        iconPath: (key) =>
            key === IcState.MEGAMORPHIC ? new ThemeIcon("warning", new ThemeColor("list.errorForeground")) :
            key === IcState.POLYMORPHIC ? new ThemeIcon("versions", new ThemeColor("list.warningForeground")) :
            key === IcState.MONOMORPHIC || key === IcState.PREMONOMORPHIC ? new ThemeIcon("symbol-constant", new ThemeColor("foreground")) :
            key === IcState.UNINITIALIZED || key === IcState.NO_FEEDBACK ? new ThemeIcon("question", new ThemeColor("list.deemphasizedForeground")) :
            new ThemeIcon("symbol-misc", new ThemeColor("foreground")),

        sorter: (q) =>
            q
            .orderByDescending(g => g.key)
    };

    private _sortBy = constants.kDefaultSortICs;
    private _showICStates = constants.kDefaultShowICStates;
    private _log?: LogFile;
    private _ics?: IcNode[];

    constructor() {
        super(() => {
            if (this._log) {
                if (!this._ics) {
                    this._ics = from(this._log.files.values())
                        .selectMany(file => file.ics)
                        .distinct()
                        .select(ic => new IcNode(this, /*parent*/ undefined, ic))
                        .through(q => this._applyFilters(q))
                        .through(q => this._applyOrder(q))
                        .toArray();
                }
                return from(this._ics)
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
            this.invalidate();
        }
    }

    get showICStates() { return this._showICStates; }
    set showICStates(value) {
        if (this._showICStates !== value) {
            this._showICStates = value;
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
        this._ics = undefined;
    }

    private _applyFilters(q: Query<IcNode>) {
        const showStateMegamorphic = this.showICStates.size === 0 || this.showICStates.has(constants.ShowICStates.Megamorphic);
        const showStatePolymorphic = this.showICStates.size === 0 || this.showICStates.has(constants.ShowICStates.Polymorphic);
        const showStateMonomorphic = this.showICStates.size === 0 || this.showICStates.has(constants.ShowICStates.Monomorphic);
        const showStateOther = this.showICStates.size === 0 || this.showICStates.has(constants.ShowICStates.Other);
        return q
            .where(({ ic }) => {
                switch (ic.getWorstIcState()) {
                    case IcState.MEGAMORPHIC: return showStateMegamorphic;
                    case IcState.POLYMORPHIC: return showStatePolymorphic;
                    case IcState.MONOMORPHIC: return showStateMonomorphic;
                    default: return showStateOther;
                }
            });
    }

    private _applyOrder(q: Query<IcNode>) {
        switch (this.sortBy) {
            case constants.SortICs.ByLocation:
                return q
                    .orderBy(node => node.file, UriComparer)
                    .thenByDescending(node => node.state)
                    .thenByDescending(node => node.hitCount);
            case constants.SortICs.ByState:
                return q
                    .orderByDescending(node => node.state)
                    .thenByDescending(node => node.hitCount)
                    .thenBy(node => node.file, UriComparer);
        }
    }

    private _applyGroups(q: Query<IcNode>) {
        switch (this.sortBy) {
            case constants.SortICs.ByLocation:
                return GroupingNode.groupBy(q.toArray(), [
                    this._groupByFile,
                    this._groupByFunction,
                    this._groupByState,
                ]);
            case constants.SortICs.ByState:
                return GroupingNode.groupBy(q.toArray(), [
                    this._groupByState,
                    this._groupByFile,
                    this._groupByFunction,
                ]);
        }
    }
}