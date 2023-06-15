// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Comparable, Comparer, Equaler, Equatable } from "@esfx/equatable";
import { from, Query } from "@esfx/iter-query";
import { formatAddress } from "#core/address.js";
import { markdown, MarkdownString } from "#core/markdown.js";
import { uriBasename, UriComparer, UriEqualer } from "#core/uri.js";
import { compareNullable, equateNullable, getNullableComparer, getNullableEqualer, hashNullable } from "#core/utils.js";
import { FunctionEntry } from "#deoptigate/functionEntry.js";
import { Location, Position, SymbolKind, ThemeIcon, Uri } from "vscode";
import * as constants from "../../constants";
import type { LogFile } from "../../model/logFile";
import { MapId, MapReference } from "../../model/mapEntry";
import { formatLocationMarkdown, LocationComparer } from "../../vscode/location";
import { PositionComparer, PositionEqualer } from "../../vscode/position";
import { formatUriMarkdown } from "../../vscode/uri";
import { BaseNodeProvider } from "../common/baseNodeProvider";
import { GroupingNode, GroupingOptions } from "../common/groupingNode";
import { MapNode } from "./mapNode";

const PAGE_SIZE = 500;

/**
 * Provides conceptual tree nodes for v8 "maps" discovered in the log file.
 */
export class MapsTreeDataProvider extends BaseNodeProvider {
    private _groupByConstructor: GroupingOptions<MapNode, MapConstructorKey, Map<string, (FunctionEntry | undefined)[]>> = {
        // collect constructors by name that have more than one entry with the same name (i.e., across different files).
        context: (nodes) =>
            from(nodes)
            .orderBy(({ mapId }) => mapId, MapId.comparer)
            .select(({ map }) => [map.constructorName, map.constructorEntry] as const)
            .where(([constructorName]) => !!constructorName)
            .groupBy(([constructorName]) => constructorName, ([, constructorEntry]) => constructorEntry, (name, group) => [name, from(group).distinct().toArray()] as const)
            .where(([, constructorEntries]) => constructorEntries.length > 1)
            .toMap(([constructorName]) => constructorName, ([, constructorEntries]) => constructorEntries),

        keyEqualer: MapConstructorKey.equaler,

        keySelector: ({ map }, ambiguousGroups) => new MapConstructorKey(
            map.constructorName,
            map.constructorEntry,
            map.mapType,
            ambiguousGroups?.get(map.constructorName)?.indexOf(map.constructorEntry)
        ),

        label: (key) => `${key}`,

        description: (_, entries) => `${entries.length}`,

        tooltip: (key) => {
            const lines: MarkdownString[] = [];
            if (key.constructorEntry) {
                const relativeTo = this.log && { log: this.log, ignoreIfBasename: true };
                lines.push(markdown`**file:** ${formatLocationMarkdown(key.constructorEntry?.filePosition, { as: "file", relativeTo: relativeTo, linkSources: this.log?.sources })}`);
            }
            return markdown`${key.name}\n\n${lines}`;
        },

        contextValue: "map-constructor",

        iconPath: new ThemeIcon("symbol-class"),

        sorter: (q) =>
            this.sortBy === constants.MapSortMode.ByName ?
                q
                .orderBy(entry => entry.key, MapConstructorKey.comparer)
                .thenByDescending(entry => entry.elements.length) :
            this.sortBy === constants.MapSortMode.ByCount ?
                q
                .orderByDescending(entry => entry.elements.length)
                .thenBy(entry => entry.key, MapConstructorKey.comparer) :
                q,
    };

    private _groupByFile: GroupingOptions<MapNode, Uri | undefined> = {
        keySelector: node => node.map.getMapFilePosition()?.uri,
        keyEqualer: getNullableEqualer(UriEqualer),

        label: (key) => key ?? "(unknown)",
        description: (_, elements) => `${elements.length}`,
        tooltip: (key) => key ? markdown`${uriBasename(key)}\n\n**file:** ${formatUriMarkdown(key, { as: "file", linkSources: this.log?.sources })}` : undefined,

        contextValue: "map-function-file",
        iconPath: ThemeIcon.File,

        sorter: (q) =>
            this.sortBy === constants.MapSortMode.ByName ?
                q
                .orderBy(entry => entry.key, getNullableComparer(UriComparer))
                .thenByDescending(entry => entry.elements.length) :
            this.sortBy === constants.MapSortMode.ByCount ?
                q
                .orderByDescending(entry => entry.elements.length)
                .thenBy(entry => entry.key, getNullableComparer(UriComparer)) :
                q,
    };

    private _groupByFunction: GroupingOptions<MapNode, MapFunctionKey> = {
        keyEqualer: MapFunctionKey.equaler,
        keySelector: ({ map }) => {
            const source = map.getMapSource();
            const filePos = map.getMapFilePosition();
            const position = source && filePos && UriEqualer.equals(filePos.uri, source.filePosition.uri) ? source.filePosition.range.start : undefined;
            return new MapFunctionKey(source?.functionName, filePos?.uri, position, source?.symbolKind);
        },

        label: (key) => `${key}`,
        description: (_, elements) => `${elements.length}`,
        tooltip: (key) => {
            const lines: MarkdownString[] = [];
            const relativeTo = this.log && { log: this.log, ignoreIfBasename: true };
            const file =
                key.file && key.position ? formatLocationMarkdown(new Location(key.file, key.position), { as: "file", relativeTo, linkSources: this.log?.sources }) :
                key.file ? formatUriMarkdown(key.file, { as: "file", relativeTo, linkSources: this.log?.sources }) :
                undefined;

            if (file) {
                lines.push(markdown`**file:** ${file}  \n`);
            }

            return markdown`${key}\n\n${lines}`;
        },

        contextValue: "map-function",
        iconPath: (key) => {
            switch (key.symbolKind) {
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

        sorter: (q) =>
            this.sortBy === constants.MapSortMode.ByName ?
                q
                .orderBy(entry => entry.key, MapFunctionKey.comparer)
                .thenByDescending(entry => entry.elements.length) :
            this.sortBy === constants.MapSortMode.ByCount ?
                q
                .orderByDescending(entry => entry.elements.length)
                .thenBy(entry => entry.key, MapFunctionKey.comparer) :
                q,
    };

    private _sortBy = constants.kDefaultMapSortMode;
    private _groupBy = constants.kDefaultGroupMaps;
    private _filter = constants.kDefaultShowMaps;
    private _log?: LogFile;
    private _maps?: MapNode[];

    constructor() {
        super(() => {
            if (this._log) {
                if (!this._maps) {
                    this._maps = from(this._log.maps)
                        .distinct()
                        .select(([mapId, map]) => new MapNode(this, /*parent*/ undefined, MapReference.fromMapId(mapId, map)))
                        .through(q => this._applyFilters(q))
                        .through(q => this._applyOrder(q))
                        .toArray();
                }
                return from(this._maps)
                    .through(q => this._applyGroups(q))
                    .toArray();
            }
            return [];
        }, { pageSize: PAGE_SIZE });
    }

    get sortBy() { return this._sortBy; }
    set sortBy(value) {
        if (this._sortBy !== value) {
            this._sortBy = value;
            this.invalidate();
        }
    }

    get filter() { return this._filter; }
    set filter(value) {
        if (this._filter !== value) {
            this._filter = value;
            this._maps = undefined;
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

    get log() { return this._log; }
    set log(value) {
        if (this._log !== value) {
            this._log = value;
            this._maps = undefined;
            this.invalidate();
        }
    }

    private _applyFilters(q: Query<MapNode>) {
        const showUnreferenced = this._filter.has(constants.ShowMaps.Unreferenced);
        const showNonUserCode = this._filter.has(constants.ShowMaps.NonUserCode);
        const showTransitions = this._filter.has(constants.ShowMaps.Transitions);
        return q
            .through(q => showUnreferenced ? q : q.where(({ map }) => map.isReferencedByIC()))
            .through(q => showNonUserCode ? q : q.where(({ map }) => !map.isNonUserCode()))
            .through(q => showTransitions ? q : q.where(({ map }) => !map.isIntermediateTransition()));
    }

    private _applyOrder(q: Query<MapNode>) {
        return q
            .orderBy(({ mapId }) => mapId, MapId.comparer);
    }

    private _applyGroups(q: Query<MapNode>) {
        const groupByFile = this.groupBy.has(constants.GroupMaps.ByFile);
        const groupByFunction = this.groupBy.has(constants.GroupMaps.ByFunction);
        const groupings: GroupingOptions<MapNode>[] = [this._groupByConstructor];
        if (groupByFile) groupings.push(this._groupByFile);
        if (groupByFunction) groupings.push(this._groupByFunction);
        return GroupingNode.groupBy(q.toArray(), groupings);
    }
}

class MapConstructorKey {
    static readonly equaler = Equaler.create<MapConstructorKey>(
        (left, right) =>
            left.constructorName === right.constructorName &&
            left.constructorEntry === right.constructorEntry &&
            left.mapType === right.mapType &&
            left.disambiguator === right.disambiguator,
        (value) => {
            let hc = 0;
            hc = Equaler.combineHashes(hc, Equaler.defaultEqualer.hash(value.constructorName));
            hc = Equaler.combineHashes(hc, Equaler.defaultEqualer.hash(value.constructorEntry));
            hc = Equaler.combineHashes(hc, Equaler.defaultEqualer.hash(value.mapType));
            hc = Equaler.combineHashes(hc, Equaler.defaultEqualer.hash(value.disambiguator));
            return hc;
        });

    static readonly comparer = Comparer.create<MapConstructorKey>(
        (left, right) =>
            Comparer.defaultComparer.compare(left.constructorName, right.constructorName) ||
            compareNullable(left.constructorEntry?.filePosition, right.constructorEntry?.filePosition, LocationComparer) ||
            Comparer.defaultComparer.compare(left.constructorEntry?.functionName, right.constructorEntry?.functionName) ||
            Comparer.defaultComparer.compare(left.mapType, right.mapType) ||
            Comparer.defaultComparer.compare(left.disambiguator, right.disambiguator)
    );

    constructor(
        readonly constructorName: string,
        readonly constructorEntry: FunctionEntry | undefined,
        readonly mapType: string | undefined,
        readonly disambiguator: number | undefined,
    ) {}

    get name() {
        return this.constructorName || this.mapType || "(unknown)";
    }

    toString() {
        if (this.constructorName && this.disambiguator !== undefined) {
            const disambiguator = this.constructorEntry?.lastSfiAddress ? formatAddress(this.constructorEntry.lastSfiAddress) : `#${this.disambiguator}`;
            return `${this.constructorName} @ ${disambiguator}`;
        }
        return this.name;
    }

    [Equatable.equals](other: unknown) {
        return other instanceof MapConstructorKey && MapConstructorKey.equaler.equals(this, other);
    }

    [Equatable.hash]() {
        return MapConstructorKey.equaler.hash(this);
    }

    [Comparable.compareTo](other: unknown) {
        return other instanceof MapConstructorKey ? MapConstructorKey.comparer.compare(this, other) : 0;
    }
}

class MapFunctionKey implements Equatable {
    static readonly equaler = Equaler.create<MapFunctionKey>(
        (left, right) =>
            left.functionName === right.functionName &&
            equateNullable(left.file, right.file, UriEqualer) &&
            equateNullable(left.position, right.position, PositionEqualer) &&
            left.symbolKind === right.symbolKind,
        (value) => {
            let hc = 0;
            hc = Equaler.combineHashes(hc, Equaler.defaultEqualer.hash(value.functionName));
            hc = Equaler.combineHashes(hc, hashNullable(value.file, UriEqualer));
            hc = Equaler.combineHashes(hc, hashNullable(value.position, PositionEqualer));
            hc = Equaler.combineHashes(hc, Equaler.defaultEqualer.hash(value.symbolKind));
            return hc;
        }
    );

    static readonly comparer = Comparer.create<MapFunctionKey>(
        (left, right) =>
            Comparer.defaultComparer.compare(left.functionName, right.functionName) ||
            compareNullable(left.file, right.file, UriComparer) ||
            compareNullable(left.position, right.position, PositionComparer) ||
            Comparer.defaultComparer.compare(left.symbolKind, right.symbolKind)
    );

    constructor(
        readonly functionName: string | undefined,
        readonly file: Uri | undefined,
        readonly position: Position | undefined,
        readonly symbolKind: SymbolKind | undefined,
    ) {
    }

    toString() {
        return this.functionName ?? "(unknown)";
    }

    [Equatable.equals](other: unknown): boolean {
        return other instanceof MapFunctionKey && MapFunctionKey.equaler.equals(this, other);
    }

    [Equatable.hash](): number {
        return MapFunctionKey.equaler.hash(this);
    }

    [Comparable.compareTo](other: unknown): number {
        return other instanceof MapFunctionKey ? MapFunctionKey.comparer.compare(this, other) : 0;
    }
}
