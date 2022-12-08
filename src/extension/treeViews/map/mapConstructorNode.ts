// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { HashSet } from "@esfx/collections-hashset";
import { Comparable, Comparer, Equaler, Equatable } from "@esfx/equatable";
import { selectMany, sum } from "@esfx/iter-fn";
import { from, Query } from "@esfx/iter-query";
import { CancellationToken, ProviderResult, ThemeIcon, TreeItem, TreeItemCollapsibleState } from "vscode";
import { formatAddress } from "../../../core/address";
import { markdown, MarkdownString } from "../../../core/markdown";
import { UriComparer } from "../../../core/uri";
import { compareNullable } from "../../../core/utils";
import { FunctionEntry } from "../../../third-party-derived/deoptigate/functionEntry";
import * as constants from "../../constants";
import { MapId } from "../../model/mapEntry";
import { formatLocation, formatLocationMarkdown, LocationComparer } from "../../vscode/location";
import { BaseNode } from "../common/baseNode";
import { PageNode } from "../common/pageNode";
import { createTreeItem } from "../createTreeItem";
import { MapFileNode, MapFileNodeEntries } from "./mapFileNode";
import { MapFunctionNode, MapFunctionNodeEntries } from "./mapFunctionNode";
import { MapNode, MapNodeEntries } from "./mapNode";
import type { MapsTreeDataProvider } from "./mapsTreeDataProvider";

/**
 * Represents a conceptual tree node for a constructor that creates a v8 "map".
 */
export class MapConstructorNode extends BaseNode {
    constructor(
        provider: MapsTreeDataProvider,
        readonly key: MapConstructorKey,
        readonly entries: MapFileNodeEntries | MapFunctionNodeEntries | MapNodeEntries
    ) {
        super(provider, /*parent*/ undefined, { description: entries.describePage });
    }

    /**
     * Gets the provider that provides this node.
     */
    get provider(): MapsTreeDataProvider { return super.provider as MapsTreeDataProvider; }

    /**
     * Gets the parent of the this node.
     */
    get parent(): undefined { return undefined; }

    protected createTreeItem() {
        return createTreeItem(this.key.toString(), TreeItemCollapsibleState.Collapsed, {
            contextValue: "map-constructor",
            iconPath: new ThemeIcon("symbol-class"),
            description: `${this.entries.countLeaves()}`
        });
    }

    resolveTreeItem(treeItem: TreeItem, token: CancellationToken): ProviderResult<TreeItem> {
        const lines: MarkdownString[] = [];
        if (this.key.constructorEntry) {
            lines.push(markdown`**File:** ${formatLocationMarkdown(this.key.constructorEntry?.filePosition, { as: "file", relativeTo: this.provider.log && { log: this.provider.log, ignoreIfBasename: true } })}`);
        }

        treeItem.tooltip = markdown`${[
            markdown`${this.key.constructorName || this.key.mapType || "(unknown)"}\n\n`,
            ...lines
        ]}`;

        return treeItem;
    }

    protected getChildren(): Iterable<MapFileNode | MapFunctionNode | MapNode> {
        return this.entries.buildAll(this.provider, this);
    }

    /**
     * Finds the conceptual tree node corresponding to the provided address.
     */
    async findNode(mapId: MapId) {
        if (this.entries.mapIds.has(mapId)) {
            for (const child of await this.children) {
                if (child instanceof MapFileNode || child instanceof MapFunctionNode || child instanceof MapNode) {
                    const descendant = await child.findNode(mapId);
                    if (descendant) return descendant;
                }
                else if (child instanceof PageNode) {
                    for (const grandchild of child.children) {
                        if (grandchild instanceof MapFileNode || grandchild instanceof MapFunctionNode || grandchild instanceof MapNode) {
                            const descendant = await grandchild.findNode(mapId);
                            if (descendant) return descendant;
                        }
                    }
                }
            }
        }
    }

    static getMapSorter(sortBy: constants.MapSortMode): (query: Query<MapConstructorNode>) => Iterable<MapConstructorNode> {
        switch (sortBy) {
            case constants.MapSortMode.ByName: return MapConstructorNode._byNameSorter;
            case constants.MapSortMode.ByCount: return MapConstructorNode._byCountSorter;
        }
    }

    private static _byNameSorter(query: Query<MapConstructorNode>): Iterable<MapConstructorNode> {
        return query
            .orderBy(entry => entry.key, MapConstructorKey.comparer)
            .thenByDescending(entry => entry.entries.countLeaves());
    }

    private static _byCountSorter(query: Query<MapConstructorNode>): Iterable<MapConstructorNode> {
        return query
            .orderByDescending(entry => entry.entries.countLeaves())
            .thenBy(entry => entry.key, MapConstructorKey.comparer);
    }
}

export class MapConstructorNodeEntries {
    private _mapIdSet: HashSet<MapId> | undefined;
    private _count: number | undefined;

    readonly kind = "constructors";

    readonly describePage = (pageNumber: number, page: readonly BaseNode[]) => {
        const first = page[0];
        const last = page[page.length - 1];
        if (!(first instanceof MapConstructorNode)) throw new TypeError();
        if (!(last instanceof MapConstructorNode)) throw new TypeError();
        return `[${first.treeItem.label ?? "(unknown)"}..${last.treeItem.label ?? "(unknown)"}]`;
    };

    constructor(
        readonly constructors: MapConstructorNodeBuilder[],
    ) {
    }

    get mapIds(): ReadonlySet<MapId> {
        return this._mapIdSet ??= new HashSet(selectMany(this.constructors, ctor => ctor.entries.mapIds), MapId);
    }

    countLeaves() {
        return this._count ??= MapConstructorNodeBuilder.countLeaves(this.constructors);
    }

    buildAll(provider: MapsTreeDataProvider, parent: undefined) {
        return from(this.constructors)
            .select(ctor => ctor.build(provider, parent))
            .through(MapConstructorNode.getMapSorter(provider.sortBy));
    }
}

export class MapConstructorNodeBuilder {
    constructor(
        readonly key: MapConstructorKey,
        readonly entries: MapFileNodeEntries | MapFunctionNodeEntries | MapNodeEntries
    ) {
    }

    /**
     * Counts the number of leaf nodes produced by a builder or node.
     */
    static countImmediateLeaves(builder: MapConstructorNodeBuilder | MapConstructorNode) {
        return builder.entries.countLeaves();
    }

    /**
     * Counts the number of leaf nodes produced by multiple builders or nodes.
     */
    static countLeaves(entries: readonly (MapConstructorNodeBuilder | MapConstructorNode)[]) {
        return sum(entries, MapConstructorNodeBuilder.countImmediateLeaves);
    }

    /**
     * Builds a node.
     */
    build(provider: MapsTreeDataProvider, parent: undefined) {
        return new MapConstructorNode(provider, this.key, this.entries);
    }
}

export class MapConstructorKey {
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

    toString() {
        if (this.constructorName && this.disambiguator !== undefined) {
            const disambiguator = this.constructorEntry?.lastSfiAddress ? formatAddress(this.constructorEntry.lastSfiAddress) : `#${this.disambiguator}`;
            return `${this.constructorName} @ ${disambiguator}`;
        }
        return this.constructorName || this.mapType || "(unknown)";
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
