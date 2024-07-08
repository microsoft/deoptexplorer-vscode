// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { SplayTree } from "#v8/tools/__benchmarks__/splaytree/splaytreeNoComparer.js";
import { Location } from "vscode";
import { RangeMap } from "../rangeMap/rangeMapUsingSplayTreesLessPolymorphism";

/**
 * Maps a {@link Location} to a value based on its uri and range.
 */
export class LocationMap<T> {
    // uri -> startLine -> startCharacter -> endLine -> endCharacter -> T
    private _files = new SplayTree<string, RangeMap<[Location, T]>>();
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
        return !!this._files.find(key.uri.toString())?.value?.has(key.range);
    }

    /**
     * Gets the value associated with a {@link Location}.
     */
    get(key: Location) {
        return this._files.find(key.uri.toString())?.value?.get(key.range)?.[1];
    }

    /**
     * Sets the value associated with a {@link Location}.
     */
    set(key: Location, value: T) {
        const uriString = key.uri.toString();
        let ranges = this._files.find(uriString)?.value;
        if (!ranges) this._files.insert(uriString, ranges = new RangeMap());
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
        const ranges = this._files.find(uriString)?.value;
        if (ranges?.delete(key.range)) {
            this._size--;
            if (ranges.size === 0) {
                this._files.remove(uriString);
            }
            return true;
        }
        return false;
    }

    /**
     * Removes all entries in the map.
     */
    clear() {
        this._files = new SplayTree();
        this._size = 0;
    }

    forEach(cb: (value: T, key: Location, map: LocationMap<T>) => unknown, thisArg?: unknown) {
        for (const [key, value] of this) {
            cb.call(thisArg, value, key, this);
        }
    }

    * keys() {
        for (const ranges of this._files.exportValues())
            for (const [key, ] of ranges.values())
                yield key;
    }

    * values(): Generator<T, void> {
        for (const ranges of this._files.exportValues())
            for (const [, value] of ranges.values())
                yield value;
    }

    * entries(): Generator<[Location, T], void> {
        for (const ranges of this._files.exportValues())
            for (const [key, value] of ranges.values())
                yield [key, value];
    }

    [Symbol.iterator]() {
        return this.entries();
    }
}
