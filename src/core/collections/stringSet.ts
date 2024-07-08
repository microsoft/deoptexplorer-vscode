// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * A {@link Set} that coerces its keys to strings internally.
 */
export class StringSet<T> {
    private _map = new Map<string, T>();
    private _toKey: (key: T) => string;

    constructor(toKey: (key: T) => string) {
        this._toKey = toKey;
    }

    get size() { return this._map.size; }

    has(value: T) {
        return this._map.has(this._toKey(value));
    }

    add(value: T) {
        this._map.set(this._toKey(value), value);
        return this;
    }

    delete(key: T) {
        return this._map.delete(this._toKey(key));
    }

    clear() {
        this._map.clear();
    }

    forEach(cb: (value: T, key: T, map: StringSet<T>) => void, thisArg?: any) {
        for (const value of this.values()) {
            cb.call(thisArg, value, value, this);
        }
    }

    * keys(): IterableIterator<T> {
        yield* this._map.values();
    }

    * values(): IterableIterator<T> {
        yield* this._map.values();
    }

    * entries(): IterableIterator<[T, T]> {
        for (const value of this._map.values()) {
            yield [value, value];
        }
    }

    [Symbol.iterator]() { return this.values(); }
}

export interface ReadonlyStringSet<T> {
    get size(): number;
    has(value: T): boolean;
    forEach(cb: (value: T, key: T, map: ReadonlyStringSet<T>) => void, thisArg?: any): void;
    keys(): IterableIterator<T>;
    values(): IterableIterator<T>;
    entries(): IterableIterator<[T, T]>;
    [Symbol.iterator](): IterableIterator<T>;
}
