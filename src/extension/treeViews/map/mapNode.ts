// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { HashSet } from "@esfx/collections-hashset";
import { Equaler, Equatable } from "@esfx/equatable";
import { identity, select } from "@esfx/iter-fn";
import { from } from "@esfx/iter-query";
import { CancellationToken, MarkdownString, ProviderResult, SymbolKind, TextDocumentShowOptions, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import { markdown } from "../../../core/markdown";
import { UriEqualer } from "../../../core/uri";
import { MapEntry, MapId } from "../../model/mapEntry";
import { openedLog } from "../../services/currentLogFile";
import { getUriForMap } from "../../textDocumentContentProviders/map";
import { formatLocation } from "../../vscode/location";
import { BaseNode } from "../common/baseNode";
import { createTreeItem } from "../createTreeItem";
import { MapConstructorNode } from "./mapConstructorNode";
import { MapFileNode, MapFileNodeBuilder, MapFileNodeEntries } from "./mapFileNode";
import { MapFunctionNode, MapFunctionNodeBuilder, MapFunctionNodeEntries } from "./mapFunctionNode";
import type { MapsTreeDataProvider } from "./mapsTreeDataProvider";

/**
 * Represents a conceptual tree node for a v8 "map".
 */
export class MapNode extends BaseNode {
    constructor(
        provider: MapsTreeDataProvider,
        parent: MapConstructorNode | MapFileNode | MapFunctionNode | undefined,
        readonly mapId: MapId
    ) {
        super(provider, parent);
    }

    /**
     * Gets the provider that provides this node.
     */
    get provider() { return super.provider as MapsTreeDataProvider; }

    /**
     * Gets the parent of the this node.
     */
    get parent() { return super.parent as MapConstructorNode | MapFileNode | MapFunctionNode | undefined; }

    protected createTreeItem() {
        return createTreeItem(this.mapId.toString(), TreeItemCollapsibleState.None, {
            contextValue: "map",
            description: openedLog?.maps.get(this.mapId)?.getMapSource()?.functionName,
            iconPath: new ThemeIcon("symbol-object"),
            command: {
                title: "",
                command: "vscode.open",
                arguments: [
                    getUriForMap(this.mapId),
                    {
                        preview: true,
                        preserveFocus: true,
                    } as TextDocumentShowOptions
                ]
            }
        });
    }

    override resolveTreeItem(treeItem: TreeItem, token: CancellationToken): ProviderResult<TreeItem> {
        const map = openedLog?.maps.get(this.mapId);
        if (map) {
            const source = map.getMapSource();
            if (source) {
                treeItem.description = `${source.functionName} (${formatLocation(map.getMapFilePosition(), { as: "file", include: "none" })})`;
            }

            const lines: MarkdownString[] = [];
            if (source) {
                lines.push(
                    markdown`**function:** ${source.functionName}  \n`,
                    markdown`**file:** ${formatLocation(map.getMapFilePosition(), { as: "file", include: "none" })}  \n`
                );
            }

            if (map.mapType) lines.push(markdown`**type:** ${map.mapType}  \n`);
            if (map.elementsKind) lines.push(markdown`**elements:** ${map.elementsKind}  \n`);
            if (map.instanceSize) lines.push(markdown`**instance size:** ${map.instanceSize}  \n`);
            if (map.inobjectPropertiesCount) lines.push(markdown`**inobject properties:** ${map.inobjectPropertiesCount}  \n`);
            if (lines) lines.unshift(markdown`\n\n`);

            treeItem.iconPath = new ThemeIcon((map.mapType && mapTypeToThemeIcon[map.mapType]) ?? "symbol-misc");
            treeItem.tooltip = markdown`${this.mapId}${lines}`;
        }
        return treeItem;
    }

    /**
     * Finds the conceptual tree node corresponding to the provided address.
     */
    findNode(mapId: MapId): MapNode | undefined {
        if (this.mapId.equals(mapId)) {
            return this;
        }
    }
}

export class MapNodeEntries {
    private _mapIdSet: HashSet<MapId> | undefined;
    private _count: number | undefined;

    readonly kind = "maps";

    readonly describePage = (pageNumber: number, page: readonly BaseNode[]) => {
        const first = page[0];
        const last = page[page.length - 1];
        if (!(first instanceof MapNode)) throw new TypeError();
        if (!(last instanceof MapNode)) throw new TypeError();
        return `[${first.mapId}..${last.mapId}]`;
    };

    constructor(
        readonly maps: MapNodeBuilder[]
    ) {
    }

    get mapIds(): ReadonlySet<MapId> {
        return this._mapIdSet ??= new HashSet(select(this.maps, map => map.mapId), MapId);
    }

    countLeaves() {
        return this._count ??= MapNodeBuilder.countLeaves(this.maps);
    }

    buildAll(provider: MapsTreeDataProvider, parent: MapConstructorNode | MapFunctionNode | MapFileNode | undefined) {
        return from(this.maps)
            .select(map => map.build(provider, parent))
            .orderBy(map => map.mapId, MapId.compare);
    }

    groupIntoFunctions() {
        return new MapFunctionNodeEntries(from(this.maps)
            .groupBy(({ map }) => {
                const source = map.getMapSource();
                return new MapFunctionKey(source?.functionName, map.getMapFilePosition()?.uri, source?.symbolKind);
            }, identity, (key, items) => new MapFunctionNodeBuilder(key.functionName, key.file, key.symbolKind, new MapNodeEntries(items.toArray())))
            .toArray());
    }

    groupIntoFiles() {
        return new MapFileNodeEntries(from(this.maps)
            .groupBy(({ map }) => map.getMapFilePosition()?.uri, identity, (key, items) => new MapFileNodeBuilder(key, new MapNodeEntries(items.toArray())), UriEqualer)
            .toArray());
    }
}

class MapFunctionKey implements Equatable {
    constructor(
        readonly functionName: string | undefined,
        readonly file: Uri | undefined,
        readonly symbolKind: SymbolKind | undefined,
    ) {
    }
    [Equatable.equals](other: unknown): boolean {
        return other instanceof MapFunctionKey &&
            this.functionName === other.functionName &&
            UriEqualer.equals(this.file, other.file) &&
            this.symbolKind === other.symbolKind;
    }
    [Equatable.hash](): number {
        return Equaler.combineHashes(
            Equaler.defaultEqualer.hash(this.functionName),
            UriEqualer.hash(this.file),
            Equaler.defaultEqualer.hash(this.symbolKind)
        );
    }
}

export class MapNodeBuilder {
    constructor(
        readonly mapId: MapId,
        readonly map: MapEntry
    ) {
    }

    static countImmediateLeaves(entry: MapNodeBuilder | MapNode) {
        return 1;
    }

    static countLeaves(entries: readonly (MapNodeBuilder | MapNode)[]) {
        return entries.length;
    }

    build(provider: MapsTreeDataProvider, parent: MapConstructorNode | MapFunctionNode | MapFileNode | undefined) {
        return new MapNode(provider, parent, this.mapId);
    }
}

const mapTypeToThemeIcon: Partial<Record<string, string>> = {
    // String
    INTERNALIZED_STRING_TYPE: "symbol-string",
    ONE_BYTE_INTERNALIZED_STRING_TYPE: "symbol-string",
    EXTERNAL_INTERNALIZED_STRING_TYPE: "symbol-string",
    EXTERNAL_ONE_BYTE_INTERNALIZED_STRING_TYPE: "symbol-string",
    UNCACHED_EXTERNAL_INTERNALIZED_STRING_TYPE: "symbol-string",
    UNCACHED_EXTERNAL_ONE_BYTE_INTERNALIZED_STRING_TYPE: "symbol-string",
    STRING_TYPE: "symbol-string",
    ONE_BYTE_STRING_TYPE: "symbol-string",
    CONS_STRING_TYPE: "symbol-string",
    CONS_ONE_BYTE_STRING_TYPE: "symbol-string",
    SLICED_STRING_TYPE: "symbol-string",
    SLICED_ONE_BYTE_STRING_TYPE: "symbol-string",
    EXTERNAL_STRING_TYPE: "symbol-string",
    EXTERNAL_ONE_BYTE_STRING_TYPE: "symbol-string",
    UNCACHED_EXTERNAL_STRING_TYPE: "symbol-string",
    UNCACHED_EXTERNAL_ONE_BYTE_STRING_TYPE: "symbol-string",
    THIN_STRING_TYPE: "symbol-string",
    THIN_ONE_BYTE_STRING_TYPE: "symbol-string",
    SHARED_STRING_TYPE: "symbol-string",
    SHARED_ONE_BYTE_STRING_TYPE: "symbol-string",
    SHARED_EXTERNAL_STRING_TYPE: "symbol-string",
    SHARED_EXTERNAL_ONE_BYTE_STRING_TYPE: "symbol-string",
    SHARED_UNCACHED_EXTERNAL_STRING_TYPE: "symbol-string",
    SHARED_UNCACHED_EXTERNAL_ONE_BYTE_STRING_TYPE: "symbol-string",
    SHARED_THIN_STRING_TYPE: "symbol-string",
    SHARED_THIN_ONE_BYTE_STRING_TYPE: "symbol-string",

    // Number
    HEAP_NUMBER_TYPE: "symbol-number",
    BIGINT_TYPE: "symbol-numeric",

    // Symbol
    SYMBOL_TYPE: "symbol-key",

    // Object
    JS_ARGUMENTS_OBJECT_TYPE: "symbol-object",
    JS_ARRAY_ITERATOR_PROTOTYPE_TYPE: "symbol-object",
    JS_ARRAY_ITERATOR_TYPE: "symbol-object",
    JS_ASYNC_FROM_SYNC_ITERATOR_TYPE: "symbol-object",
    JS_ASYNC_FUNCTION_OBJECT_TYPE: "symbol-object",
    JS_ASYNC_GENERATOR_OBJECT_TYPE: "symbol-object",
    JS_CONTEXT_EXTENSION_OBJECT_TYPE: "symbol-object",
    JS_DATA_VIEW_TYPE: "symbol-object",
    JS_ERROR_TYPE: "symbol-object",
    JS_EXTERNAL_OBJECT_TYPE: "symbol-object",
    JS_GENERATOR_OBJECT_TYPE: "symbol-object",
    JS_ITERATOR_PROTOTYPE_TYPE: "symbol-object",
    JS_MAP_ITERATOR_PROTOTYPE_TYPE: "symbol-object",
    JS_MAP_KEY_ITERATOR_TYPE: "symbol-object",
    JS_MAP_KEY_VALUE_ITERATOR_TYPE: "symbol-object",
    JS_MAP_TYPE: "symbol-object",
    JS_MAP_VALUE_ITERATOR_TYPE: "symbol-object",
    JS_MESSAGE_OBJECT_TYPE: "symbol-object",
    JS_MODULE_NAMESPACE_TYPE: "symbol-object",
    JS_OBJECT_PROTOTYPE_TYPE: "symbol-object",
    JS_OBJECT_TYPE: "symbol-object",
    JS_PRIMITIVE_WRAPPER_TYPE: "symbol-object",
    JS_PROMISE_PROTOTYPE_TYPE: "symbol-object",
    JS_PROMISE_TYPE: "symbol-object",
    JS_PROXY_TYPE: "symbol-object",
    JS_RAW_JSON_TYPE: "symbol-object",
    JS_REG_EXP_STRING_ITERATOR_TYPE: "symbol-object",
    JS_SET_ITERATOR_PROTOTYPE_TYPE: "symbol-object",
    JS_SET_KEY_VALUE_ITERATOR_TYPE: "symbol-object",
    JS_SET_PROTOTYPE_TYPE: "symbol-object",
    JS_SET_TYPE: "symbol-object",
    JS_SET_VALUE_ITERATOR_TYPE: "symbol-object",
    JS_SHADOW_REALM_TYPE: "symbol-object",
    JS_STRING_ITERATOR_PROTOTYPE_TYPE: "symbol-object",
    JS_STRING_ITERATOR_TYPE: "symbol-object",
    JS_WEAK_MAP_TYPE: "symbol-object",
    JS_WEAK_SET_TYPE: "symbol-object",

    JS_SHARED_STRUCT_TYPE: "symbol-struct",
    JS_REG_EXP_PROTOTYPE_TYPE: "regex",
    JS_REG_EXP_TYPE: "regex",

    JS_DATE_TYPE: "calendar",
    JS_TEMPORAL_CALENDAR_TYPE: "calendar",
    JS_TEMPORAL_DURATION_TYPE: "calendar",
    JS_TEMPORAL_INSTANT_TYPE: "calendar",
    JS_TEMPORAL_PLAIN_DATE_TIME_TYPE: "calendar",
    JS_TEMPORAL_PLAIN_DATE_TYPE: "calendar",
    JS_TEMPORAL_PLAIN_MONTH_DAY_TYPE: "calendar",
    JS_TEMPORAL_PLAIN_TIME_TYPE: "calendar",
    JS_TEMPORAL_PLAIN_YEAR_MONTH_TYPE: "calendar",
    JS_TEMPORAL_TIME_ZONE_TYPE: "calendar",
    JS_TEMPORAL_ZONED_DATE_TIME_TYPE: "calendar",

    // Array
    BYTE_ARRAY_TYPE: "symbol-array",
    BYTECODE_ARRAY_TYPE: "symbol-array",
    EMBEDDER_DATA_ARRAY_TYPE: "symbol-array",
    TRANSITION_ARRAY_TYPE: "symbol-array",
    JS_ARRAY_BUFFER_TYPE: "symbol-array",
    JS_TYPED_ARRAY_TYPE: "symbol-array",
    JS_TYPED_ARRAY_PROTOTYPE_TYPE: "symbol-array",
    JS_SHARED_ARRAY_TYPE: "symbol-array",
    JS_ARRAY_TYPE: "symbol-array",
    
    // Function
    JS_FUNCTION_TYPE: "symbol-function",
    JS_CLASS_CONSTRUCTOR_TYPE: "symbol-function",
    JS_PROMISE_CONSTRUCTOR_TYPE: "symbol-function",
    JS_REG_EXP_CONSTRUCTOR_TYPE: "symbol-function",
    JS_ARRAY_CONSTRUCTOR_TYPE: "symbol-function",
}