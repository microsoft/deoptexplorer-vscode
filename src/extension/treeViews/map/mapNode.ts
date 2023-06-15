// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { count } from "@esfx/iter-fn";
import { markdown } from "#core/markdown.js";
import { CancellationToken, MarkdownString, ProviderResult, TextDocumentShowOptions, ThemeIcon, TreeItem, TreeItemCollapsibleState } from "vscode";
import { GroupMaps } from "../../constants";
import { MapReference } from "../../model/mapEntry";
import { getUriForMap } from "../../textDocumentContentProviders/map";
import { formatLocation, formatLocationMarkdown } from "../../vscode/location";
import { formatUriMarkdown } from "../../vscode/uri";
import { BaseNode } from "../common/baseNode";
import { createTreeItem } from "../createTreeItem";
import type { MapsTreeDataProvider } from "./mapsTreeDataProvider";

/**
 * Represents a conceptual tree node for a v8 "map".
 */
export class MapNode extends BaseNode {
    constructor(
        provider: MapsTreeDataProvider,
        parent: BaseNode | undefined,
        readonly mapRef: MapReference,
    ) {
        super(provider, parent);
    }

    get provider() { return super.provider as MapsTreeDataProvider; }
    get mapId() { return this.mapRef.mapId; }
    get map() { return this.mapRef.map; }

    protected createTreeItem() {
        const groupByFunction = this.provider.groupBy.has(GroupMaps.ByFunction);
        return createTreeItem(this.mapId.toString(), TreeItemCollapsibleState.None, {
            contextValue: "map",
            description: !groupByFunction ? this.map?.getMapSource()?.functionName : undefined,
            iconPath: new ThemeIcon((this.map.mapType && mapTypeToThemeIcon[this.map.mapType]) ?? "symbol-misc"),
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
        const source = this.map.getMapSource();
        if (source) {
            treeItem.description = `${source.functionName} (${formatLocation(this.map.getMapFilePosition(), { as: "file", include: "none" })})`;
        }

        const lines: MarkdownString[] = [];
        if (source) {
            const relativeTo = this.provider.log && { log: this.provider.log, ignoreIfBasename: true };
            lines.push(
                markdown`**function:** ${source.functionName}  \n`,
                markdown`**file:** ${formatLocationMarkdown(this.map.getMapFilePosition(), { as: "file", relativeTo, linkSources: this.provider.log?.sources })}  \n`
            );
        }

        if (this.map.mapType) lines.push(markdown`**type:** ${this.map.mapType}  \n`);
        if (this.map.elementsKind) lines.push(markdown`**elements:** ${this.map.elementsKind}  \n`);
        if (this.map.instanceSize) lines.push(markdown`**instance size:** ${this.map.instanceSize}  \n`);
        if (this.map.inobjectPropertiesCount) lines.push(markdown`**inobject properties:** ${this.map.inobjectPropertiesCount}  \n`);
        lines.push(markdown`**ics:** ${count(this.map.referencedBy, ref => ref.kind === "ic")}  \n`);

        const header = formatUriMarkdown(getUriForMap(this.mapId), { label: `${this.mapId}`, title: `${this.mapId}` });
        treeItem.tooltip = markdown`${header}\n\n${lines}`;
        return treeItem;
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