// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { HashSet } from "@esfx/collections-hashset";
import { select, selectMany, sum } from "@esfx/iter-fn";
import { from } from "@esfx/iter-query";
import { ThemeIcon, TreeItemCollapsibleState, Uri } from "vscode";
import { UriComparer } from "../../../core/uri";
import * as constants from "../../constants";
import { MapId } from "../../model/mapEntry";
import { BaseNode } from "../common/baseNode";
import { PageNode } from "../common/pageNode";
import { createTreeItem } from "../createTreeItem";
import { MapConstructorNode } from "./mapConstructorNode";
import { MapFunctionNode, MapFunctionNodeEntries } from "./mapFunctionNode";
import { MapNode, MapNodeEntries } from "./mapNode";
import type { MapsTreeDataProvider } from "./mapsTreeDataProvider";

/**
 * Represents a conceptual tree node for a file containing functions that have seen a map.
 */
 export class MapFileNode extends BaseNode {
    constructor(
        provider: MapsTreeDataProvider,
        parent: MapConstructorNode | undefined,
        readonly file: Uri | null | undefined,
        readonly entries: MapFunctionNodeEntries | MapNodeEntries,
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
    get parent() { return super.parent as MapConstructorNode | undefined; }

    protected createTreeItem() {
        return createTreeItem(this.file ?? "(unknown)", TreeItemCollapsibleState.Collapsed, {
            contextValue: "map-function-file",
            iconPath: ThemeIcon.File,
            description: `${this.entries.countLeaves()}`
        });
    }

    protected getChildren(): Iterable<MapFunctionNode | MapNode> {
        return this.entries.buildAll(this.provider, this);
    }

    /**
     * Finds the conceptual tree node corresponding to the provided address.
     */
    async findNode(mapId: MapId) {
        if (this.entries.mapIds.has(mapId)) {
            for (const child of await this.children) {
                if (child instanceof MapFunctionNode || child instanceof MapNode) {
                    const descendant = await child.findNode(mapId);
                    if (descendant) return descendant;
                }
                else if (child instanceof PageNode) {
                    for (const grandchild of child.children) {
                        if (grandchild instanceof MapFunctionNode || grandchild instanceof MapNode) {
                            const descendant = await grandchild.findNode(mapId);
                            if (descendant) return descendant;
                        }
                    }
                }
            }
        }
    }

    static getMapSorter(sortBy: constants.MapSortMode): (query: Iterable<MapFileNode>) => Iterable<MapFileNode> {
        switch (sortBy) {
            case constants.MapSortMode.ByName: return MapFileNode._byNameSorter;
            case constants.MapSortMode.ByCount: return MapFileNode._byCountSorter;
        }
    }

    private static _byNameSorter(query: Iterable<MapFileNode>): Iterable<MapFileNode> {
        return from(query)
            .orderBy(node => node.file, UriComparer)
            .thenByDescending(MapFileNodeBuilder.countImmediateLeaves);
    }

    private static _byCountSorter(query: Iterable<MapFileNode>): Iterable<MapFileNode> {
        return from(query)
            .orderByDescending(MapFileNodeBuilder.countImmediateLeaves)
            .thenBy(node => node.file, UriComparer);
    }
}

export class MapFileNodeEntries {
    private _mapIdSet: HashSet<MapId> | undefined;
    private _count: number | undefined;

    readonly kind = "files";

    readonly describePage = (pageNumber: number, page: readonly BaseNode[]) => {
        const first = page[0];
        const last = page[page.length - 1];
        if (!(first instanceof MapFileNode)) throw new TypeError();
        if (!(last instanceof MapFileNode)) throw new TypeError();
        return `[${first.treeItem.label ?? "(unknown)"}..${last.treeItem.label ?? "(unknown)"}]`;
    };

    constructor(
        readonly files: MapFileNodeBuilder[],
    ) {
    }

    get mapIds(): ReadonlySet<MapId> {
        return this._mapIdSet ??= new HashSet(selectMany(this.files, file => file.entries.mapIds), MapId);
    }

    countLeaves() {
        return this._count ??= MapFileNodeBuilder.countLeaves(this.files);
    }

    buildAll(provider: MapsTreeDataProvider, parent: MapConstructorNode | undefined) {
        return from(this.files)
            .select(file => file.build(provider, parent))
            .through(MapFileNode.getMapSorter(provider.sortBy));
    }
}

export class MapFileNodeBuilder {
    constructor(
        readonly file: Uri | null | undefined,
        readonly entries: MapFunctionNodeEntries | MapNodeEntries,
    ) {
    }

    static countImmediateLeaves(entry: MapFileNodeBuilder | MapFileNode) {
        return entry.entries.countLeaves();
    }

    static countLeaves(entries: readonly (MapFileNodeBuilder | MapFileNode)[]) {
        return sum(entries, MapFileNodeBuilder.countImmediateLeaves);
    }

    build(provider: MapsTreeDataProvider, parent: MapConstructorNode | undefined) {
        return new MapFileNode(provider, parent, this.file, this.entries);
    }
}