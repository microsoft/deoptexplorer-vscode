// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import { assert } from "./assert";

declare global { interface KnownTypes { } }
declare global { interface KnownSerializers { } }

export interface Serializer<T extends object = object, TSerialized extends object = object> {
    readonly builtin?: boolean;
    canSerialize(object: object & Partial<T>): boolean;
    canDeserialize(object: object & Partial<TSerialized>): boolean;
    serialize(object: T, serialize: (value: unknown, newSerializers?: Iterable<Serializer>) => unknown): TSerialized;
    deserialize(object: TSerialized, deserialize: (value: unknown, newSerializers?: Iterable<Serializer>) => unknown): T;
}

export type RegisteredSerializer<T, U> = [T, U];

export type KnownType<K extends keyof KnownSerializers | keyof KnownTypes = keyof KnownSerializers | keyof KnownTypes> =
    K extends keyof KnownSerializers ? KnownSerializers[K][0] :
    K extends keyof KnownTypes ? KnownTypes[K] :
    never;

export type KnownSerializedType<K extends keyof KnownSerializers> = KnownSerializers[K][1];
export interface KnownSerializer<K extends keyof KnownSerializers> extends Serializer<KnownType<K>, KnownSerializedType<K>> {
}

const knownSerializers: Map<keyof KnownSerializers, KnownSerializer<keyof KnownSerializers>> = new Map();
let knownSerializersArray: Serializer[] | undefined;

function getKnownSerializers() {
    return knownSerializersArray ?? (knownSerializersArray = [...new Set(knownSerializers.values())]);
}

export function registerKnownSerializer<K extends keyof KnownSerializers>(key: K, serializer: KnownSerializer<K>) {
    knownSerializersArray = undefined;
    knownSerializers.set(key, serializer);
    return serializer;
}

function isJsonSerializable(value: object): value is { toJSON(): unknown } {
    return typeof (value as any).toJSON === "function";
}

class SerializerCircularities {
    nextId = 0;
    map = new Map<object, CircularityRecord>();
}

interface CircularityRecord {
    id?: number;
    value?: unknown;
}

class DeserializerCircularities {
    values = new Map<number, unknown>();
    seen = new Set<object>();
}

interface Circularity {
    $type: "circular";
    id: number;
    value?: unknown;
}

function isCircularity(value: object): value is Circularity {
    return (value as Circularity).$type === "circular";
}

function serializeWorkerExcludeBuiltins(value: unknown, serializers: Serializer[], serialize: (value: unknown, newSerializers?: Iterable<Serializer>) => unknown, circularities: SerializerCircularities) {
    return serializeWorker(value, serializers, serialize, circularities, /*ignoreBuiltins*/ true);
}

function serializeWorkerIncludeBuiltins(value: unknown, serializers: Serializer[], serialize: (value: unknown, newSerializers?: Iterable<Serializer>) => unknown, circularities: SerializerCircularities) {
    return serializeWorker(value, serializers, serialize, circularities, /*ignoreBuiltins*/ false);
}

function serializeCircularity(value: unknown, originalValue: object, circularity: CircularityRecord, circularities: SerializerCircularities) {
    circularities.map.delete(originalValue);
    if (circularity.id !== undefined) {
        circularity.value = value;
        return { $type: "circular", id: circularity.id, value };
    }
    return value;
}

function serializeWorker(value: unknown, serializers: Serializer[], serialize: (value: unknown, newSerializers?: Iterable<Serializer>) => unknown, circularities: SerializerCircularities, ignoreBuiltins: boolean) {
    if (typeof value === "bigint") {
        return { $type: "bigint", value: value.toString() };
    }

    if (typeof value !== "object" || value === null) {
        return value;
    }

    let circularity = circularities.map.get(value);
    if (circularity) {
        // If the circularity does not have an ID, we've already since it once
        // give the circularity an `id` so that we can mark it as circular
        if (circularity.id === undefined) {
            circularity.id = circularities.nextId++;
        }
        return { $type: "circular", id: circularity.id };
    }

    // we haven't seen this value yet, so track it in case we have an eventual circularity.
    circularity = {};
    circularities.map.set(value, circularity);
    for (const serializer of serializers) {
        if (serializer.canSerialize(value)) {
            if (serializer.builtin && ignoreBuiltins) {
                return value;
            }
            const result = serializer.serialize(value, serialize);
            if (circularity.id !== undefined) throw new Error("Invalid circularity in custom-serialised object");
            return result;
        }
    }

    if (isJsonSerializable(value)) {
        return serializeCircularity(value.toJSON(), value, circularity, circularities);
    }

    if (Array.isArray(value)) {
        let result: unknown[] | undefined;
        for (let i = 0; i < value.length; i++) {
            const item = value[i];
            const serialized = serialize(item, serializers);
            if (serialized !== item || result || circularity.id !== undefined) {
                if (!result) {
                    result = value.slice(0, i);
                }
                result[i] = serialized;
            }
        }
        return serializeCircularity(result ?? value, value, circularity, circularities);
    }
    else {
        const pairs: [string, unknown][] = [];
        let result: Record<string, unknown> | undefined;
        for (let key in value) {
            const item = (value as any)[key];
            const serialized = serialize(item, serializers);
            if (serialized !== item || result || circularity.id !== undefined) {
                if (!result) {
                    result = {};
                    for (const [key, value] of pairs) {
                        result[key] = value;
                    }
                }
                result[key] = serialized;
            }
            else {
                pairs.push([key, serialized]);
            }
        }
        return serializeCircularity(result ?? value, value, circularity, circularities);
    }
}

function deserializeWorker(value: unknown, deserializers: Serializer[], deserialize: (value: unknown, newSerializers?: Iterable<Serializer>) => unknown, circularities: DeserializerCircularities) {
    if (typeof value !== "object" || value === null) {
        return value;
    }

    if ("$type" in value && (value as any).$type === "bigint") {
        return BigInt((value as any).value);
    }

    for (const deserializer of deserializers) {
        if (deserializer.canDeserialize(value)) {
            if (circularities.seen.has(value)) {
                throw new TypeError("Circular reference in deserialization");
            }
            circularities.seen.add(value);
            try {
                return deserializer.deserialize(value, deserialize);
            }
            finally {
                circularities.seen.delete(value);
            }
        }
    }

    let circularity: Circularity | undefined;
    if (isCircularity(value)) {
        circularity = value;
        if (circularity.value === undefined) {
            assert(circularities.values.has(circularity.id));
            return circularities.values.get(circularity.id);
        }
        value = circularity.value;
        if (typeof value !== "object" || value === null) {
            circularities.values.set(circularity.id, value);
            return value;
        }
    }

    if (circularities.seen.has(value)) {
        throw new TypeError("Circular reference in deserialization");
    }

    circularities.seen.add(value);
    try
    {
        if (Array.isArray(value)) {
            let result: unknown[] | undefined;
            if (circularity) {
                result = [];
                circularities.values.set(circularity.id, result);
            }
            for (let i = 0; i < value.length; i++) {
                const item = value[i];
                const deserialized = deserialize(item, deserializers);
                if (deserialized !== item || result) {
                    if (!result) {
                        result = value.slice(0, i);
                    }
                    result[i] = deserialized;
                }
            }
            return result ?? value;
        }
        else {
            const prototype = Object.getPrototypeOf(value);
            if (prototype !== Object.prototype && prototype !== null) {
                // not a plain object, nothing to deserialize
                return value;
            }

            const pairs: [string, unknown][] = [];
            let result: Record<string, unknown> | undefined;
            if (circularity) {
                result = {};
                circularities.values.set(circularity.id, result);
            }

            for (let key in value) {
                const item = (value as any)[key];
                const deserialized = deserialize(item, deserializers);
                if (deserialized !== item || result) {
                    if (!result) {
                        result = {};
                        for (const [key, value] of pairs) {
                            result[key] = value;
                        }
                    }
                    result[key] = deserialized;
                }
                else {
                    pairs.push([key, deserialized]);
                }
            }
            return result ?? value;
        }
    }
    finally {
        circularities.seen.delete(value);
    }
}

function combineSerializers(oldSerializers: Serializer[], newSerializers: Iterable<Serializer> | undefined) {
    if (!newSerializers || newSerializers === oldSerializers) return oldSerializers;
    const newSerializerSet = new Set(newSerializers);
    for (const oldSerializer of oldSerializers) {
        newSerializerSet.add(oldSerializer);
    }
    if (newSerializerSet.size === oldSerializers.length) {
        return oldSerializers;
    }
    return [...newSerializerSet];
}

function makeHandler<T>(oldSerializers: Serializer[], worker: (value: unknown, serializers: Serializer[], handler: (value: unknown, newSerializers?: Iterable<Serializer>) => unknown, state: T) => unknown, state: T): (value: unknown, newSerializers?: Iterable<Serializer>) => unknown {
    const handler = (value: unknown, newSerializers?: Iterable<Serializer>): unknown => {
        const serializers = combineSerializers(oldSerializers, newSerializers);
        return worker(value, serializers, serializers !== oldSerializers ? makeHandler(serializers, worker, state) : handler, state);
    };
    return handler;
}

export function serialize(value: unknown, serializers?: Iterable<Serializer>, ignoreBuiltins?: boolean) {
    return makeHandler(combineSerializers(getKnownSerializers(), serializers), ignoreBuiltins ? serializeWorkerExcludeBuiltins : serializeWorkerIncludeBuiltins, new SerializerCircularities())(value);
}

export function deserialize(value: unknown, serializers?: Iterable<Serializer>) {
    return makeHandler(combineSerializers(getKnownSerializers(), serializers), deserializeWorker, new DeserializerCircularities())(value);
}

declare global { interface KnownSerializers {
    RegExp: RegisteredSerializer<RegExp, { $mid: 2, source: string, flags: string }>;
} }

export const RegExpSerializer = registerKnownSerializer("RegExp", {
    canSerialize: obj => obj instanceof RegExp,
    canDeserialize: obj => obj.$mid === 2,
    serialize: obj => ({ $mid: 2, source: obj.source, flags: obj.flags }),
    deserialize: obj => new RegExp(obj.source, obj.flags),
    builtin: true
});

declare global { interface KnownSerializers {
    Map: RegisteredSerializer<Map<unknown, unknown>, { $type: "Map", entries: [unknown, unknown][] }>;
} }

export const MapSerializer = registerKnownSerializer("Map", {
    canSerialize: obj => obj instanceof Map,
    canDeserialize: obj => obj.$type === "Map",
    serialize: (obj, serialize) => ({ $type: "Map", entries: from(obj).toArray(([key, value]) => [serialize(key), serialize(value)]) }),
    deserialize: (obj, deserialize) => new Map(from(obj.entries).select(([key, value]) => [deserialize(key), deserialize(value)]))
});

declare global { interface KnownSerializers {
    Set: RegisteredSerializer<Set<unknown>, { $type: "Set", values: unknown[] }>;
} }

export const SetSerializer = registerKnownSerializer("Set", {
    canSerialize: obj => obj instanceof Set,
    canDeserialize: obj => obj.$type === "Set",
    serialize: (obj, serialize) => ({ $type: "Set", values: from(obj).toArray(value => serialize(value)) }),
    deserialize: (obj, deserialize) => new Set(from(obj.values).select(value => deserialize(value)))
});
