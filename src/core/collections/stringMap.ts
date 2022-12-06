// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * A {@link Map} that coerces its keys to strings internally.
 */
export class StringMap<K, V> {
    private _map = new Map<string, { key: K, value: V }>();
    private _toKey: (key: K) => string;

    constructor(toKey: (key: K) => string, iterable?: Iterable<[K, V]>) {
        this._toKey = toKey;
        if (iterable) {
            for (const [key, value] of iterable) {
                this.set(key, value);
            }
        }
    }

    get size() {
        return this._map.size;
    }

    has(key: K) {
        return this._map.has(this._toKey(key));
    }

    get(key: K) {
        return this._map.get(this._toKey(key))?.value;
    }

    set(key: K, value: V) {
        const keyString = this._toKey(key);
        let entry = this._map.get(keyString);
        if (!entry) {
            this._map.set(keyString, entry = { key, value });
        }
        else {
            entry.value = value;
        }
        return this;
    }

    delete(key: K) {
        return this._map.delete(this._toKey(key));
    }

    clear() {
        this._map.clear();
    }

    forEach(cb: (value: V, key: K, map: StringMap<K, V>) => void, thisArg?: any) {
        for (const [key, value] of this.entries()) {
            cb.call(thisArg, value, key, this);
        }
    }

    * keys(): IterableIterator<K> {
        for (const { key } of this._map.values()) {
            yield key;
        }
    }

    * values(): IterableIterator<V> {
        for (const { value } of this._map.values()) {
            yield value;
        }
    }

    * entries(): IterableIterator<[K, V]> {
        for (const { key, value } of this._map.values()) {
            yield [key, value];
        }
    }

    [Symbol.iterator]() {
        return this.entries();
    }
}