// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { HashSet } from "@esfx/collections-hashset";
import { selectMany, sum } from "@esfx/iter-fn";
import { from, Query } from "@esfx/iter-query";
import { ThemeIcon, TreeItemCollapsibleState } from "vscode";
import * as constants from "../../constants";
import { MapId } from "../../model/mapEntry";
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
        readonly constructorName: string,
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
        return createTreeItem(this.constructorName, TreeItemCollapsibleState.Collapsed, {
            contextValue: "map-constructor",
            iconPath: new ThemeIcon("symbol-class"),
            description: `${this.entries.countLeaves()}`
        });
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
            .orderBy(entry => entry.constructorName)
            .thenByDescending(entry => entry.entries.countLeaves());
    }

    private static _byCountSorter(query: Query<MapConstructorNode>): Iterable<MapConstructorNode> {
        return query
            .orderByDescending(entry => entry.entries.countLeaves())
            .thenBy(entry => entry.constructorName);
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
        readonly constructorName: string,
        readonly entries: MapFileNodeEntries | MapFunctionNodeEntries | MapNodeEntries
    ) {
    }

    static countImmediateLeaves(builder: MapConstructorNodeBuilder | MapConstructorNode) {
        return builder.entries.countLeaves();
    }

    static countLeaves(entries: readonly (MapConstructorNodeBuilder | MapConstructorNode)[]) {
        return sum(entries, MapConstructorNodeBuilder.countImmediateLeaves);
    }

    build(provider: MapsTreeDataProvider, parent: undefined) {
        return new MapConstructorNode(provider, this.constructorName, this.entries);
    }
}