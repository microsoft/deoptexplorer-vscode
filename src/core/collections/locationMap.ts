// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Location } from "vscode";

/**
 * Maps a {@link Location} to a value based on its uri and range.
 */
export class LocationMap<T> {
    // uri -> startLine -> startCharacter -> endLine -> endCharacter -> T
    private _files: Map<string, Map<number, Map<number, [Location, T] | Map<number, Map<number, [Location, T]>>>>> = new Map();
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
        const uriString = key.uri.toString();
        const { start: { line: startLine, character: startCharacter }, end: { line: endLine, character: endCharacter } } = key.range;
        const entry = this._files.get(uriString)?.get(startLine)?.get(startCharacter);
        if (entry instanceof Map) {
            return entry.get(endLine)?.has(endCharacter) ?? false;
        }
        else if (Array.isArray(entry)) {
            return key.range.isEmpty;
        }
        return false;
    }

    /**
     * Gets the value associated with a {@link Location}.
     */
    get(key: Location) {
        const uriString = key.uri.toString();
        const { start: { line: startLine, character: startCharacter }, end: { line: endLine, character: endCharacter } } = key.range;
        const entry = this._files.get(uriString)?.get(startLine)?.get(startCharacter);
        if (entry instanceof Map) {
            return entry.get(endLine)?.get(endCharacter)?.[1];
        }
        else if (Array.isArray(entry) && key.range.isEmpty) {
            return entry[1];
        }
    }

    /**
     * Sets the value associated with a {@link Location}.
     */
    set(key: Location, value: T) {
        const uriString = key.uri.toString();
        const { start: { line: startLine, character: startCharacter }, end: { line: endLine, character: endCharacter } } = key.range;

        let startLines = this._files.get(uriString);
        if (!startLines) this._files.set(uriString, startLines = new Map());

        let startCharacters = startLines.get(startLine);
        if (!startCharacters) startLines.set(startLine, startCharacters = new Map());

        let endLines = startCharacters.get(startCharacter);
        let endCharacters;
        if (!endLines) {
            // if we have an empty range, set it as the sole value at this step.
            if (key.range.isEmpty) {
                startCharacters.set(startCharacter, [key, value]);
                this._size++;
                return this;
            }

            startCharacters.set(startCharacter, endLines = new Map());
        }
        else if (Array.isArray(endLines)) {
            // we previously set an empty range. If the range is empty, just update the value.
            if (key.range.isEmpty) {
                endLines[1] = value;
                return this;
            }

            // migrate the single entry for the empty range to an individual map entry.
            const existingEntry = endLines;
            startCharacters.set(startCharacter, endLines = new Map());

            const { line: existingEndLine, character: existingEndCharacter } = existingEntry[0].range.end;
            let existingEndCharacters = endLines.get(existingEndLine);
            if (!existingEndCharacters) endLines.set(existingEndLine, existingEndCharacters = new Map());
            existingEndCharacters.set(existingEndCharacter, existingEntry);

            // if both the existing entry and the new entry have the same line,  reuse the existing end
            // character map so we don't perform the lookup twice.
            if (existingEndLine === endLine) {
                endCharacters = existingEndCharacters;
            }
        }

        if (!endCharacters) endCharacters = endLines.get(endLine);
        if (!endCharacters) endLines.set(endLine, endCharacters = new Map());

        let entry = endCharacters.get(endCharacter);
        if (!entry) {
            this._size++;
            endCharacters.set(endCharacter, [key, value]);
        }
        else {
            entry[1] = value;
        }

        return this;
    }

    /**
     * Deletes the entry for a {@link Location}.
     * @returns `true` if the {@link Location} was deleted; otherwise, `false`.
     */
    delete(key: Location) {
        const uriString = key.uri.toString();
        const { start: { line: startLine, character: startCharacter }, end: { line: endLine, character: endCharacter } } = key.range;

        const startLines = this._files.get(uriString);
        if (!startLines) return false;

        const startCharacters = startLines.get(startLine);
        if (!startCharacters) return false;

        const endLines = startCharacters.get(startCharacter);
        if (!endLines) return false;

        if (Array.isArray(endLines)) {
            // If the existing entry's range was empty, we can delete it if the requested
            // entry's range is empty
            if (key.range.isEmpty) {
                this._size--;
                startCharacters.delete(startCharacter);
                if (startCharacters.size === 0) {
                    startLines.delete(startLine);
                    if (startLines.size === 0) {
                        this._files.delete(uriString);
                    }
                }
                return true;
            }
            return false;
        }

        const endCharacters = endLines.get(endLine);
        if (!endCharacters) return false;

        if (endCharacters.delete(endCharacter)) {
            this._size--;
            if (endCharacters.size === 0) {
                endLines.delete(endLine);
                if (endLines.size === 0) {
                    startCharacters.delete(startCharacter);
                    if (startCharacters.size === 0) {
                        startLines.delete(startLine);
                        if (startLines.size === 0) {
                            this._files.delete(uriString);
                        }
                    }
                }
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
        for (const startLines of this._files.values())
        for (const startCharacters of startLines.values())
        for (const endLines of startCharacters.values()) {
            if (Array.isArray(endLines)) {
                yield endLines[0];
            }
            else {
                for (const endCharacters of endLines.values())
                for (const { 0: key } of endCharacters.values()) {
                    yield key;
                }
            }
        }
    }

    * values() {
        for (const startLines of this._files.values())
        for (const startCharacters of startLines.values())
        for (const endLines of startCharacters.values()) {
            if (Array.isArray(endLines)) {
                yield endLines[1];
            }
            else {
                for (const endCharacters of endLines.values())
                for (const { 1: value } of endCharacters.values()) {
                    yield value;
                }
            }
        }
    }

    * entries() {
        for (const startLines of this._files.values())
        for (const startCharacters of startLines.values())
        for (const endLines of startCharacters.values()) {
            if (Array.isArray(endLines)) {
                yield [endLines[0], endLines[1]] as [Location, T];
            }
            else {
                for (const endCharacters of endLines.values())
                for (const { 0: key, 1: value } of endCharacters.values()) {
                    yield [key, value] as [Location, T];
                }

            }
        }
    }

    [Symbol.iterator]() {
        return this.entries();
    }
}
