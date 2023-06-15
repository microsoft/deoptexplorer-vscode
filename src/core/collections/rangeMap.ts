// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { SplayTree } from "#v8/tools/splaytree.js";
import { Position, Range } from "vscode";

/**
 * Maps a {@link Range} to a value.
 */
export class RangeMap<T> {
    // startLine -> startCharacter -> endLine -> endCharacter -> T
    private _ranges: SplayTree<number, SplayTree<number, [Range, T] | SplayTree<number, SplayTree<number, [Range, T]>>>> = new SplayTree();
    private _size: number = 0;

    get size() {
        return this._size;
    }

    has(key: Range) {
        const { start: { line: startLine, character: startCharacter }, end: { line: endLine, character: endCharacter } } = key;
        const entry = this._ranges.find(startLine)?.value.find(startCharacter)?.value;
        if (entry instanceof SplayTree) {
            return !!entry.find(endLine)?.value.find(endCharacter);
        }
        else if (Array.isArray(entry)) {
            return key.isEmpty;
        }
        return false;
    }

    get(key: Range) {
        const { start: { line: startLine, character: startCharacter }, end: { line: endLine, character: endCharacter } } = key;
        const entry = this._ranges.find(startLine)?.value.find(startCharacter)?.value;
        if (entry instanceof SplayTree) {
            return entry.find(endLine)?.value.find(endCharacter)?.value[1];
        }
        else if (Array.isArray(entry) && key.isEmpty) {
            return entry[1];
        }
    }

    /**
     * Find all entries contained by the provided range.
     */
    findAll(positionOrRange: Position | Range) {
        const entries: [Range, T][] = [];
        const { start, end } = positionOrRange instanceof Range ? positionOrRange : { start: positionOrRange, end: positionOrRange };
        for (let startLine = this._ranges.findGreatestLessThan(start.line); startLine; startLine = startLine.left) {
            for (let startCharacter = startLine.key === start.line ? startLine.value.findGreatestLessThan(start.character) : startLine.value.findMax(); startCharacter; startCharacter = startCharacter.left) {
                if (Array.isArray(startCharacter.value)) {
                    if (startCharacter.value[0].contains(positionOrRange)) {
                        entries.unshift([startCharacter.value[0], startCharacter.value[1]]);
                    }
                }
                else {
                    const inOrderEntries: [Range, T][] = [];
                    for (let endLine = startCharacter.value.findLeastGreaterThan(end.line); endLine; endLine = endLine.right) {
                        for (let endCharacter = endLine.key === end.line ? endLine.value.findLeastGreaterThan(end.character) : endLine.value.findMin(); endCharacter; endCharacter = endCharacter.right) {
                            if (endCharacter.value[0].contains(positionOrRange)) {
                                inOrderEntries.push([endCharacter.value[0], endCharacter.value[1]]);
                            }
                        }
                    }
                    if (inOrderEntries.length) {
                        entries.unshift(...inOrderEntries);
                    }
                }
            }
        }
        return entries;
    }

    set(key: Range, value: T) {
        const { start: { line: startLine, character: startCharacter }, end: { line: endLine, character: endCharacter } } = key;

        let startCharacters = this._ranges.find(startLine)?.value;
        if (!startCharacters) this._ranges.insert(startLine, startCharacters = new SplayTree());

        let endLines = startCharacters.find(startCharacter)?.value;
        let endCharacters: SplayTree<number, [Range, T]> | undefined;
        if (!endLines) {
            // if we have an empty range, set it as the sole value at this step.
            if (key.isEmpty) {
                startCharacters.insert(startCharacter, [key, value]);
                this._size++;
                return this;
            }

            startCharacters.insert(startCharacter, endLines = new SplayTree());
        }
        else if (Array.isArray(endLines)) {
            // we previously set an empty range. If the range is empty, just update the value.
            if (key.isEmpty) {
                endLines[1] = value;
                return this;
            }

            // migrate the single entry for the empty range to an individual map entry.
            const existingEntry = endLines;
            startCharacters.insert(startCharacter, endLines = new SplayTree());

            const { line: existingEndLine, character: existingEndCharacter } = existingEntry[0].end;
            let existingEndCharacters = endLines.find(existingEndLine)?.value;
            if (!existingEndCharacters) endLines.insert(existingEndLine, existingEndCharacters = new SplayTree());
            existingEndCharacters.insert(existingEndCharacter, existingEntry);

            // if both the existing entry and the new entry have the same line,  reuse the existing end
            // character map so we don't perform the lookup twice.
            if (existingEndLine === endLine) {
                endCharacters = existingEndCharacters;
            }
        }

        if (!endCharacters) endCharacters = endLines.find(endLine)?.value;
        if (!endCharacters) endLines.insert(endLine, endCharacters = new SplayTree());

        let entry = endCharacters.find(endCharacter)?.value;
        if (!entry) {
            this._size++;
            endCharacters.insert(endCharacter, [key, value]);
        }
        else {
            entry[1] = value;
        }

        return this;
    }

    delete(key: Range) {
        const { start: { line: startLine, character: startCharacter }, end: { line: endLine, character: endCharacter } } = key;

        const startCharacters = this._ranges.find(startLine)?.value;
        if (!startCharacters) return false;

        const endLines = startCharacters.find(startCharacter)?.value;
        if (!endLines) return false;

        if (Array.isArray(endLines)) {
            // If the existing entry's range was empty, we can delete it if the requested
            // entry's range is empty
            if (key.isEmpty) {
                this._size--;
                startCharacters.remove(startCharacter);
                if (startCharacters.isEmpty()) {
                    this._ranges.remove(startLine);
                }
                return true;
            }
            return false;
        }

        const endCharacters = endLines.find(endLine)?.value;
        if (!endCharacters) return false;

        if (endCharacters.find(endCharacter)) {
            endCharacters.remove(endCharacter);
            this._size--;
            if (endCharacters.isEmpty()) {
                endLines.remove(endLine);
                if (endLines.isEmpty()) {
                    startCharacters.remove(startCharacter);
                    if (startCharacters.isEmpty()) {
                        this._ranges.remove(startLine);
                    }
                }
            }
            return true;
        }
        return false;
    }

    clear() {
        this._ranges = new SplayTree();
        this._size = 0;
    }

    forEach(cb: (value: T, key: Range, map: RangeMap<T>) => void, thisArg?: any) {
        for (const [key, value] of this) {
            cb.call(thisArg, value, key, this);
        }
    }

    * keys() {
        for (const startCharacters of this._ranges.exportValues())
        for (const endLines of startCharacters.exportValues()) {
            if (Array.isArray(endLines)) {
                yield endLines[0];
            }
            else {
                for (const endCharacters of endLines.exportValues())
                for (const { 0: key } of endCharacters.exportValues()) {
                    yield key;
                }
            }
        }
    }

    * values() {
        for (const startCharacters of this._ranges.exportValues())
        for (const endLines of startCharacters.exportValues()) {
            if (Array.isArray(endLines)) {
                yield endLines[1];
            }
            else {
                for (const endCharacters of endLines.exportValues())
                for (const { 1: value } of endCharacters.exportValues()) {
                    yield value;
                }
            }
        }
    }

    * entries() {
        for (const startCharacters of this._ranges.exportValues())
        for (const endLines of startCharacters.exportValues()) {
            if (Array.isArray(endLines)) {
                yield [endLines[0], endLines[1]] as [Range, T];
            }
            else {
                for (const endCharacters of endLines.exportValues())
                for (const { 0: key, 1: value } of endCharacters.exportValues()) {
                    yield [key, value] as [Range, T];
                }

            }
        }
    }

    [Symbol.iterator]() {
        return this.entries();
    }
}
