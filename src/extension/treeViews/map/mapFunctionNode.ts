// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { HashSet } from "@esfx/collections-hashset";
import { identity, selectMany, sum } from "@esfx/iter-fn";
import { from } from "@esfx/iter-query";
import { CancellationToken, Location, ProviderResult, SymbolKind, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import { markdown } from "../../../core/markdown";
import { UriEqualer } from "../../../core/uri";
import * as constants from "../../constants";
import { MapId } from "../../model/mapEntry";
import { formatLocation } from "../../vscode/location";
import { formatUri } from "../../vscode/uri";
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
        readonly functionName: string | undefined,
        readonly file: Uri | undefined,
        readonly symbolKind: SymbolKind | undefined,
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
        return createTreeItem(this.functionName ?? "(unknown)", TreeItemCollapsibleState.Collapsed, {
            contextValue: "map-function",
            iconPath: this.getIconPath(),
            description: `${this.entries.countLeaves()}`
        });
    }

    override resolveTreeItem(treeItem: TreeItem, token: CancellationToken): ProviderResult<TreeItem> {
        treeItem.tooltip = markdown`${[
            markdown`${this.functionName ?? "(unknown)"}\n\n`,
            markdown`**file:** ${formatUri(this.file, { as: "file" })}  \n`
        ]}`;
        return treeItem;
    }

    private getIconPath() {
        switch (this.symbolKind) {
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
            .orderBy(node => node.functionName ?? "(unknown)")
            .thenByDescending(MapFunctionNodeBuilder.countImmediateLeaves);
    }

    private static _byCountSorter(query: Iterable<MapFunctionNode>): Iterable<MapFunctionNode> {
        return from(query)
            .orderByDescending(MapFunctionNodeBuilder.countImmediateLeaves)
            .thenBy(node => node.functionName ?? "(unknown)");
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
        return `[${first.functionName ?? "(unknown)"}..${last.functionName ?? "(unknown)"}]`;
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
                ({ file }) => file,
                identity,
                (key, items) => new MapFileNodeBuilder(key, new MapFunctionNodeEntries(items.toArray())), UriEqualer)
            .toArray());
    }
}

export class MapFunctionNodeBuilder {
    constructor(
        readonly functionName: string | undefined,
        readonly file: Uri | undefined,
        readonly symbolKind: SymbolKind | undefined,
        readonly entries: MapNodeEntries,
    ) {}

    static countImmediateLeaves(entry: MapFunctionNodeBuilder | MapFunctionNode) {
        return entry.entries.countLeaves();
    }

    static countLeaves(entries: readonly (MapFunctionNodeBuilder | MapFunctionNode)[]) {
        return sum(entries, MapFunctionNodeBuilder.countImmediateLeaves);
    }

    build(provider: MapsTreeDataProvider, parent: MapConstructorNode | MapFileNode | undefined) {
        return new MapFunctionNode(provider, parent, this.functionName, this.file, this.symbolKind, this.entries);
    }
}