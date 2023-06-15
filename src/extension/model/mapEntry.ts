// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Comparable, Comparer, Equaler, Equatable } from "@esfx/equatable";
import { compare, equate, every, hash } from "@esfx/iter-fn";
import { Address, formatAddress, parseAddress } from "#core/address.js";
import { MarkdownString, ToMarkdownString } from "#core/markdown.js";
import { Sources } from "#core/sources.js";
import { TimeTicks } from "#core/time.js";
import { FunctionEntry } from "#deoptigate/functionEntry.js";
import { IcEntry, IcEntryUpdate } from "#deoptigate/icEntry.js";
import { kNullAddress } from "#v8/constants.js";
import { MapEvent } from "#v8/enums/mapEvent.js";
import { Location } from "vscode";
import { EntryBase } from "./entry";

export class MapId implements ToMarkdownString {
    private _text: string | undefined;

    static readonly equaler = Equaler.create<MapId>(
        (left, right) =>
            left.address === right.address &&
            left.index === right.index,
        (value) => Equaler.combineHashes(
            Equaler.defaultEqualer.hash(value.address),
            Equaler.defaultEqualer.hash(value.index)
        )
    );

    static readonly comparer = Comparer.create<MapId>(
        (left, right) =>
            Comparer.defaultComparer.compare(left.address, right.address) ||
            Comparer.defaultComparer.compare(left.index, right.index)
    );

    static readonly NONE = new MapId(kNullAddress, 0);

    constructor(
        readonly address: Address,
        readonly index: number
    ) {
        if (address === kNullAddress && index === 0 && MapId.NONE) {
            return MapId.NONE;
        }
    }

    static tryParse(text: string) {
        const fields = /^(?<address>0x[A-Fa-f0-9]+)(?:[$_#:](?<index>\d+))?$/.exec(text)?.groups;
        if (!fields) return undefined;
        const address = parseAddress(fields.address);
        const index = fields.index ? parseInt(fields.index, 10) : 0;
        return new MapId(address, index);
    }

    static parse(text: string) {
        const result = MapId.tryParse(text);
        if (!result) throw new RangeError();
        return result;
    }

    toString() {
        return this._text ??= this.index ? `${formatAddress(this.address)}_${this.index}` : formatAddress(this.address);
    }

    [ToMarkdownString.toMarkdownString]() {
        return new MarkdownString(this.toString());
    }

    equals(other: MapId) {
        return MapId.equaler.equals(this, other);
    }

    hash() {
        return MapId.equaler.hash(this);
    }

    compareTo(other: MapId) {
        return MapId.comparer.compare(this, other);
    }

    [Equatable.equals](other: unknown) {
        return other instanceof MapId && this.equals(other);
    }

    [Equatable.hash]() {
        return this.hash();
    }

    [Comparable.compareTo](other: unknown) {
        return other instanceof MapId ? this.compareTo(other) : 0;
    }
}

/**
 * Represents a V8 "Map"
 */
export class MapEntry {
    declare kind: "map";
    static { this.prototype.kind = "map"; }

    private _constructorName?: string;

    details: string = "";
    constructorEntry?: FunctionEntry;
    baseMap?: MapReference;
    mapType?: string;
    elementsKind?: string;
    instanceSize?: number;
    inobjectPropertiesCount?: number;
    unusedPropertyFields?: number;

    readonly updates: MapEntryUpdate[] = [];
    readonly properties: MapProperty[] = [];
    readonly referencedBy: MapReferencedBy[] = [];

    constructor(
        readonly timestamp: TimeTicks,
    ) {
    }

    get constructorName() {
        return this.constructorEntry?.functionName
            ?? this._constructorName
            ?? "";
    }

    set constructorName(value) {
        this._constructorName = value;
    }

    isReferencedByIC() {
        return this.referencedBy.some(ref => ref.kind === "ic");
    }

    isNonUserCode() {
        // if every update is from non-user code, this is non-user code.
        if (!this.updates.length || every(this.updates, update => !update.functionEntry || update.functionEntry.isNonUserCode())) return true;
        if (this.mapType && nonUserCodeMapTypes.has(this.mapType) && !this.properties.length) return true;
        return false;
    }

    isIntermediateTransition() {
        const references = this.referencedBy.filter(ref => ref.kind === "map") as MapReferencedByMap[];
        if (!references.length) return false;
        const thisSource = this.getMapSource();
        for (const { map } of references) {
            const source = map.map.getMapSource();
            if (source !== thisSource) return false;
        }
        return true;
    }

    * propertySources() {
        let lastSource: FunctionEntry | undefined;
        for (const prop of this.properties) {
            if (prop.source && prop.source !== lastSource) {
                yield prop.source;
            }
        }
    }

    getMapFilePosition(): Location | undefined {
        let update: MapEntryUpdate | undefined;
        for (let i = this.updates.length - 1; i >= 0; i--) {
            update = this.updates[i];
            if (update.filePosition) {
                return update.filePosition;
            }
        }
        if (update?.event === MapEvent.Transition) {
            return update.fromMap?.getMapFilePosition();
        }
    }

    getMapSource(): FunctionEntry | undefined {
        let update: MapEntryUpdate | undefined;
        for (let i = this.updates.length - 1; i >= 0; i--) {
            update = this.updates[i];
            if (update.functionEntry) {
                return update.functionEntry;
            }
        }
        if (update?.event === MapEvent.Transition) {
            return update.fromMap?.getMapSource();
        }
    }
}

/**
 * Represents an timeline update to a V8 "Map"
 */
export class MapEntryUpdate extends EntryBase {
    declare kind: "map-update";
    functionEntry?: FunctionEntry;
    generatedFunctionName?: string;

    private _functionName?: string;

    constructor(
        sources: Sources,
        public event: MapEvent,
        public timestamp: TimeTicks,
        public fromMapId: MapId,
        public fromMap: MapEntry | undefined,
        public toMapId: MapId,
        public toMap: MapEntry | undefined,
        public reason: string,
        public name: SymbolName | string,
    ) {
        super(sources, /*filePosition*/ undefined)
    }

    get functionName() {
        return this.functionEntry?.functionName
            ?? this._functionName
            ?? "";
    }

    set functionName(value) {
        this._functionName = value;
    }
}

MapEntryUpdate.prototype.kind = "map-update";

export class SymbolName implements Equatable, Comparable {
    constructor(readonly name: string | number) {
    }

    [Comparable.compareTo](other: unknown): number {
        if (!(other instanceof SymbolName)) return 0;
        return SymbolNameComparer.compare(this, other);
    }

    [Equatable.equals](other: unknown): boolean {
        return other instanceof SymbolName && SymbolNameEqualer.equals(this, other);
    }

    [Equatable.hash](): number {
        return SymbolNameEqualer.hash(this);
    }

    static tryParse(text: string) {
        try {
            if (text.startsWith("symbol(") && text.endsWith(")")) {
                text = text.slice(7, -1).trim();

                let hashIndex = text.lastIndexOf("hash ");
                let hash: number | undefined;
                if (hashIndex >= 0) {
                    hash = parseInt(text.slice(hashIndex + 5).trim(), 16);
                    if (isFinite(hash)) {
                        text = text.slice(0, hashIndex).trim();
                    }
                }

                if (text.startsWith(`"`)) return new SymbolName(JSON.parse(text));
                 if (hash !== undefined) return new SymbolName(hash);
            }
        }
        catch {
        }
    }

    toString() {
        return typeof this.name === "string" ?
            `[symbol(${JSON.stringify(this.name)})]` :
            `[symbol(hash ${this.name.toString(16)})]`;
    }
}

export const SymbolNameEqualer = Equaler.create<SymbolName>(
    (a, b) => equate(a.name, b.name),
    (a) => Equaler.combineHashes(
        hash(SymbolName),
        hash(a.name),
    )
);

export const SymbolNameComparer = Comparer.create<SymbolName>(
    (a, b) =>
        compare(typeof a.name === "string" ? 1 : 0, typeof b.name === "string" ? 1 : 0) ||
        compare(a.name, b.name)
);

export const PropertyNameEqualer = Equaler.create<string | SymbolName>(
    (a, b) => a === b || a instanceof SymbolName && b instanceof SymbolName && SymbolNameEqualer.equals(a, b),
    (a) => a instanceof SymbolName ? SymbolNameEqualer.hash(a) : hash(a)
);

export const PropertyNameComparer = Comparer.create<string | SymbolName>(
    (a, b) =>
        a instanceof SymbolName ? b instanceof SymbolName ? SymbolNameComparer.compare(a, b) : -1 :
        b instanceof SymbolName ? +1 :
        compare(a, b)
);

/**
 * Represents a property in a V8 "Map"
 */
export class MapProperty {
    map?: MapReference;
    type?: "none" | "tagged" | "smi" | "double" | "heap" | MapId;
    writable?: boolean;
    enumerable?: boolean;
    configurable?: boolean;
    source?: FunctionEntry;
    update?: MapEntryUpdate;

    constructor(
        readonly name: string | SymbolName,
        options?: Pick<MapProperty, "map" | "type" | "writable" | "enumerable" | "configurable" | "source" | "update">
    ) {
        this.map = options?.map;
        this.type = options?.type;
        this.writable = options?.writable;
        this.enumerable = options?.enumerable;
        this.configurable = options?.configurable;
        this.source = options?.source;
        this.update = options?.update;
    }

    get filePosition() { return this.update?.filePosition; }
    get generatedFilePosition() { return this.update?.generatedFilePosition; }

    clone() {
        return new MapProperty(this.name, this);
    }
}

/**
 * Represents a reference to a V8 "Map" from another V8 "Map"
 */
export class MapReferencedByMap {
    declare kind: "map";

    constructor(
        readonly map: MapReference
    ) {
    }
}

MapReferencedByMap.prototype.kind = "map";

/**
 * Represents a reference to a V8 "Map" from a V8 "Map" property
 */
export class MapReferencedByMapProperty {
    declare kind: "property";

    constructor(
        readonly property: MapProperty
    ) {
    }
}

MapReferencedByMapProperty.prototype.kind = "property";

/**
 * Represents a reference to a V8 "Map" from an IC entry update.
 */
export class MapReferencedByIcEntryUpdate {
    declare kind: "ic";

    constructor(
        readonly entry: IcEntry,
        readonly update: IcEntryUpdate
    ) {
    }
}

MapReferencedByIcEntryUpdate.prototype.kind = "ic";

export type MapReferencedBy =
    | MapReferencedByMap
    | MapReferencedByMapProperty
    | MapReferencedByIcEntryUpdate
    ;

/**
 * Represents a reference to a V8 "Map" at a specific address.
 */
export class MapReference {
    private _mapId: MapId | undefined;

    constructor(
        readonly address: Address,
        readonly index: number,
        readonly map: MapEntry,
        readonly reason?: string,
    ) {
    }

    get mapId() {
        return this._mapId ??= new MapId(this.address, this.index);
    }

    static fromMapId(mapId: MapId, map: MapEntry) {
        const result = new MapReference(mapId.address, mapId.index, map);
        result._mapId = mapId;
        return result;
    }
}

const nonUserCodeMapTypes = new Set([
    "INTERNALIZED_STRING_TYPE",
    "ONE_BYTE_INTERNALIZED_STRING_TYPE",
    "EXTERNAL_INTERNALIZED_STRING_TYPE",
    "EXTERNAL_ONE_BYTE_INTERNALIZED_STRING_TYPE",
    "UNCACHED_EXTERNAL_INTERNALIZED_STRING_TYPE",
    "UNCACHED_EXTERNAL_ONE_BYTE_INTERNALIZED_STRING_TYPE",
    "STRING_TYPE",
    "ONE_BYTE_STRING_TYPE",
    "CONS_STRING_TYPE",
    "CONS_ONE_BYTE_STRING_TYPE",
    "SLICED_STRING_TYPE",
    "SLICED_ONE_BYTE_STRING_TYPE",
    "EXTERNAL_STRING_TYPE",
    "EXTERNAL_ONE_BYTE_STRING_TYPE",
    "UNCACHED_EXTERNAL_STRING_TYPE",
    "UNCACHED_EXTERNAL_ONE_BYTE_STRING_TYPE",
    "THIN_STRING_TYPE",
    "THIN_ONE_BYTE_STRING_TYPE",
    "SHARED_STRING_TYPE",
    "SHARED_ONE_BYTE_STRING_TYPE",
    "SHARED_EXTERNAL_STRING_TYPE",
    "SHARED_EXTERNAL_ONE_BYTE_STRING_TYPE",
    "SHARED_UNCACHED_EXTERNAL_STRING_TYPE",
    "SHARED_UNCACHED_EXTERNAL_ONE_BYTE_STRING_TYPE",
    "SHARED_THIN_STRING_TYPE",
    "SHARED_THIN_ONE_BYTE_STRING_TYPE",
    "BIGINT_TYPE",
    "BYTE_ARRAY_TYPE",
    "BYTECODE_ARRAY_TYPE",
    "EMBEDDER_DATA_ARRAY_TYPE",
    "HEAP_NUMBER_TYPE",
    "JS_API_OBJECT_TYPE",
    "JS_ARGUMENTS_OBJECT_TYPE",
    "JS_ARRAY_BUFFER_TYPE",
    "JS_ARRAY_CONSTRUCTOR_TYPE",
    "JS_ARRAY_ITERATOR_PROTOTYPE_TYPE",
    "JS_ARRAY_ITERATOR_TYPE",
    "JS_ASYNC_FROM_SYNC_ITERATOR_TYPE",
    "JS_ASYNC_FUNCTION_OBJECT_TYPE",
    "JS_ASYNC_GENERATOR_OBJECT_TYPE",
    "JS_CLASS_CONSTRUCTOR_TYPE",
    "JS_CONTEXT_EXTENSION_OBJECT_TYPE",
    "JS_DATA_VIEW_TYPE",
    "JS_DATE_TYPE",
    "JS_ERROR_TYPE",
    "JS_EXTERNAL_OBJECT_TYPE",
    "JS_GENERATOR_OBJECT_TYPE",
    "JS_ITERATOR_PROTOTYPE_TYPE",
    "JS_MAP_ITERATOR_PROTOTYPE_TYPE",
    "JS_MAP_KEY_ITERATOR_TYPE",
    "JS_MAP_KEY_VALUE_ITERATOR_TYPE",
    "JS_MAP_TYPE",
    "JS_MAP_VALUE_ITERATOR_TYPE",
    "JS_MESSAGE_OBJECT_TYPE",
    "JS_MODULE_NAMESPACE_TYPE",
    "JS_OBJECT_PROTOTYPE_TYPE",
    "JS_PRIMITIVE_WRAPPER_TYPE",
    "JS_PROMISE_CONSTRUCTOR_TYPE",
    "JS_PROMISE_PROTOTYPE_TYPE",
    "JS_PROMISE_TYPE",
    "JS_PROXY_TYPE",
    "JS_RAW_JSON_TYPE",
    "JS_REG_EXP_CONSTRUCTOR_TYPE",
    "JS_REG_EXP_PROTOTYPE_TYPE",
    "JS_REG_EXP_STRING_ITERATOR_TYPE",
    "JS_REG_EXP_TYPE",
    "JS_SET_ITERATOR_PROTOTYPE_TYPE",
    "JS_SET_KEY_VALUE_ITERATOR_TYPE",
    "JS_SET_PROTOTYPE_TYPE",
    "JS_SET_TYPE",
    "JS_SET_VALUE_ITERATOR_TYPE",
    "JS_SHADOW_REALM_TYPE",
    "JS_SHARED_ARRAY_TYPE",
    "JS_SHARED_STRUCT_TYPE",
    "JS_STRING_ITERATOR_PROTOTYPE_TYPE",
    "JS_STRING_ITERATOR_TYPE",
    "JS_TEMPORAL_CALENDAR_TYPE",
    "JS_TEMPORAL_DURATION_TYPE",
    "JS_TEMPORAL_INSTANT_TYPE",
    "JS_TEMPORAL_PLAIN_DATE_TIME_TYPE",
    "JS_TEMPORAL_PLAIN_DATE_TYPE",
    "JS_TEMPORAL_PLAIN_MONTH_DAY_TYPE",
    "JS_TEMPORAL_PLAIN_TIME_TYPE",
    "JS_TEMPORAL_PLAIN_YEAR_MONTH_TYPE",
    "JS_TEMPORAL_TIME_ZONE_TYPE",
    "JS_TEMPORAL_ZONED_DATE_TIME_TYPE",
    "JS_TYPED_ARRAY_PROTOTYPE_TYPE",
    "JS_TYPED_ARRAY_TYPE",
    "JS_WEAK_MAP_TYPE",
    "JS_WEAK_SET_TYPE",
    "SYMBOL_TYPE",
    "TRANSITION_ARRAY_TYPE",
]);