// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { HashSet } from "@esfx/collections-hashset";
import { Comparable, Comparer, Equaler, Equatable } from "@esfx/equatable";
import { identity, selectMany, sum } from "@esfx/iter-fn";
import { from } from "@esfx/iter-query";
import { CancellationToken, Location, Position, ProviderResult, SymbolKind, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import { markdown, MarkdownString } from "../../../core/markdown";
import { UriComparer, UriEqualer } from "../../../core/uri";
import { compareNullable, equateNullable, hashNullable } from "../../../core/utils";
import * as constants from "../../constants";
import { MapId } from "../../model/mapEntry";
import { formatLocationMarkdown } from "../../vscode/location";
import { PositionComparer, PositionEqualer } from "../../vscode/position";
import { formatUriMarkdown } from "../../vscode/uri";
import { BaseNode } from "../common/baseNode";
import { PageNode } from "../common/pageNode";
import { createTreeItem } from "../createTreeItem";
import { MapConstructorNode } from "./mapConstructorNode";
import { MapFileNode, MapFileNodeBuilder, MapFileNodeEntries } from "./mapFileNode";
import { MapNode, MapNodeEntries } from "./mapNode";
import type { MapsTreeDataProvider } from "./mapsTreeDataProvider";

/**
 * Represents a conceptual tree node for a function that has seen a map.
 */
 export class MapFunctionNode extends BaseNode {
    constructor(
        provider: MapsTreeDataProvider,
        parent: MapConstructorNode | MapFileNode | undefined,
        readonly key: MapFunctionKey,
        readonly entries: MapNodeEntries
    ) {
        super(provider, parent, { description: entries.describePage });
    }

    /**
     * Gets the provider that provides this node.
     */
    get provider() { return super.provider as MapsTreeDataProvider; }

    /**
     * Gets the parent of the this node.
     */
    get parent() { return super.parent as MapConstructorNode | MapFileNode | undefined; }

    protected createTreeItem() {
        return createTreeItem(this.key.functionName ?? "(unknown)", TreeItemCollapsibleState.Collapsed, {
            contextValue: "map-function",
            iconPath: this.getIconPath(),
            description: `${this.entries.countLeaves()}`
        });
    }

    override resolveTreeItem(treeItem: TreeItem, token: CancellationToken): ProviderResult<TreeItem> {
        const lines: MarkdownString[] = [];

        const relativeTo = this.provider.log && { log: this.provider.log, ignoreIfBasename: true };
        const file =
            this.key.file && this.key.position ? formatLocationMarkdown(new Location(this.key.file, this.key.position), { as: "file", relativeTo }) :
            this.key.file ? formatUriMarkdown(this.key.file, { as: "file", relativeTo }) :
            undefined;

        if (file) {
            lines.push(markdown`**file:** ${file}  \n`);
        }

        treeItem.tooltip = markdown`${[
            markdown`${this.key.functionName ?? "(unknown)"}\n\n`,
            ...lines
        ]}`;

        return treeItem;
    }

    private getIconPath() {
        switch (this.key.symbolKind) {
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
    }

    protected getChildren(): Iterable<MapNode> {
        return this.entries.buildAll(this.provider, this);
    }

    /**
     * Finds the conceptual tree node corresponding to the provided address.
     */
    async findNode(mapId: MapId) {
        if (this.entries.mapIds.has(mapId)) {
            for (const child of await this.children) {
                if (child instanceof MapNode) {
                    const descendant = child.findNode(mapId);
                    if (descendant) return descendant;
                }
                else if (child instanceof PageNode) {
                    for (const grandchild of child.children) {
                        if (grandchild instanceof MapNode) {
                            const descendant = grandchild.findNode(mapId);
                            if (descendant) return descendant;
                        }
                    }
                }
            }
        }
    }

    static getMapSorter(sortBy: constants.MapSortMode): (query: Iterable<MapFunctionNode>) => Iterable<MapFunctionNode> {
        switch (sortBy) {
            case constants.MapSortMode.ByName: return MapFunctionNode._byNameSorter;
            case constants.MapSortMode.ByCount: return MapFunctionNode._byCountSorter;
        }
    }

    private static _byNameSorter(query: Iterable<MapFunctionNode>): Iterable<MapFunctionNode> {
        return from(query)
            .orderBy(node => node.key, MapFunctionKey.comparer)
            .thenByDescending(MapFunctionNodeBuilder.countImmediateLeaves);
    }

    private static _byCountSorter(query: Iterable<MapFunctionNode>): Iterable<MapFunctionNode> {
        return from(query)
            .orderByDescending(MapFunctionNodeBuilder.countImmediateLeaves)
            .thenBy(node => node.key, MapFunctionKey.comparer);
    }
}

export class MapFunctionNodeEntries {
    private _mapIdSet: HashSet<MapId> | undefined;
    private _count: number | undefined;

    readonly kind = "functions";

    readonly describePage = (pageNumber: number, page: readonly BaseNode[]) => {
        const first = page[0];
        const last = page[page.length - 1];
        if (!(first instanceof MapFunctionNode)) throw new TypeError();
        if (!(last instanceof MapFunctionNode)) throw new TypeError();
        return `[${first.key.functionName ?? "(unknown)"}..${last.key.functionName ?? "(unknown)"}]`;
    };

    constructor(
        readonly functions: MapFunctionNodeBuilder[],
    ) {
    }

    get mapIds(): ReadonlySet<MapId> {
        return this._mapIdSet ??= new HashSet(selectMany(this.functions, func => func.entries.mapIds), MapId);
    }

    countLeaves() {
        return this._count ??= MapFunctionNodeBuilder.countLeaves(this.functions);
    }

    buildAll(provider: MapsTreeDataProvider, parent: MapConstructorNode | MapFileNode | undefined) {
        return from(this.functions)
            .map(builder => builder.build(provider, parent))
            .through(MapFunctionNode.getMapSorter(provider.sortBy));
    }

    groupIntoFiles() {
        return new MapFileNodeEntries(from(this.functions)
            .groupBy(
                ({ key: { file } }) => file,
                identity,
                (key, items) => new MapFileNodeBuilder(key, new MapFunctionNodeEntries(items.toArray())), UriEqualer)
            .toArray());
    }
}

export class MapFunctionNodeBuilder {
    constructor(
        readonly key: MapFunctionKey,
        readonly entries: MapNodeEntries,
    ) {}

    static countImmediateLeaves(entry: MapFunctionNodeBuilder | MapFunctionNode) {
        return entry.entries.countLeaves();
    }

    static countLeaves(entries: readonly (MapFunctionNodeBuilder | MapFunctionNode)[]) {
        return sum(entries, MapFunctionNodeBuilder.countImmediateLeaves);
    }

    build(provider: MapsTreeDataProvider, parent: MapConstructorNode | MapFileNode | undefined) {
        return new MapFunctionNode(provider, parent, this.key, this.entries);
    }
}

export class MapFunctionKey implements Equatable {
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
