// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Location } from "vscode";
import { RangeMap } from "../rangeMap/rangeMapUsingSplayTreeWithComparer";

/**
 * Maps a {@link Location} to a value based on its uri and range.
 */
export class LocationMap<T> {
    // uri -> startLine -> startCharacter -> endLine -> endCharacter -> T
    private _files = new Map<string, RangeMap<[Location, T]>>();
    private _size: number = 0;

    /**
     * Gets the number of locations in the map.
     */
    get size() {
        return this._size;
    }

    /**
     * Returns a value indicating whether the provided {@link Location} exists in the map.
     */
    has(key: Location) {
        return !!this._files.get(key.uri.toString())?.has(key.range);
    }

    /**
     * Gets the value associated with a {@link Location}.
     */
    get(key: Location) {
        return this._files.get(key.uri.toString())?.get(key.range)?.[1];
    }

    /**
     * Sets the value associated with a {@link Location}.
     */
    set(key: Location, value: T) {
        const uriString = key.uri.toString();
        let ranges = this._files.get(uriString);
        if (!ranges) this._files.set(uriString, ranges = new RangeMap());
        const initialSize = ranges.size;
        ranges.set(key.range, [key, value]);
        if (initialSize > ranges.size) {
            this._size++;
        }
        return this;
    }

    /**
     * Deletes the entry for a {@link Location}.
     * @returns `true` if the {@link Location} was deleted; otherwise, `false`.
     */
    delete(key: Location) {
        const uriString = key.uri.toString();
        const ranges = this._files.get(uriString);
        if (ranges?.delete(key.range)) {
            this._size--;
            if (ranges.size === 0) {
                this._files.delete(uriString);
            }
            return true;
        }
        return false;
    }

    /**
     * Removes all entries in the map.
     */
    clear() {
        this._files.clear();
        this._size = 0;
    }

    forEach(cb: (value: T, key: Location, map: LocationMap<T>) => unknown, thisArg?: unknown) {
        for (const [key, value] of this) {
            cb.call(thisArg, value, key, this);
        }
    }

    * keys() {
        for (const ranges of this._files.values())
            for (const [key, ] of ranges.values())
                yield key;
    }

    * values(): Generator<T, void> {
        for (const ranges of this._files.values())
            for (const [, value] of ranges.values())
                yield value;
    }

    * entries(): Generator<[Location, T], void> {
        for (const ranges of this._files.values())
            for (const [key, value] of ranges.values())
                yield [key, value];
    }

    [Symbol.iterator]() {
        return this.entries();
    }
}
