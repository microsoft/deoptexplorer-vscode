// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Position, Range } from "vscode";

type CharacterMap<T> = T[];
type LineMap<T> = CharacterMap<T>[];
type EndLineMap<T> = LineMap<T>;
type StartLineMap<T> = LineMap<EndLineMap<Entry<T>>>;
type Entry<T> = [Range, T];

export class RangeMap<T> {
    private _ranges: StartLineMap<T> = [];
    private _size: number = 0;

    get size() {
        return this._size;
    }

    has(range: Range) {
        const { start, end } = range;
        const entry = findPosition(this._ranges, start);
        if (entry) {
            return !!findPosition(entry, end);
        }
        return false;
    }

    get(key: Range) {
        const { start, end } = key;
        const entry = findPosition(this._ranges, start);
        if (entry) {
            return findPosition(entry, end)?.[1];
        }
    }

    set(key: Range, value: T) {
        const { start, end } = key;
        const startCharacters = ensureCharactersForLine(this._ranges, start);
        const endLines = ensureLinesForCharacter(startCharacters, start);
        const endCharacters = ensureCharactersForLine(endLines, end);
        let entry = get(endCharacters, end.character);
        if (!entry) {
            this._size++;
            endCharacters[end.character] = [key, value];
        }
        else {
            entry[1] = value;
        }

        return this;
    }

    delete(key: Range) {
        const { start, end } = key;

        const startCharacters = get(this._ranges, start.line);
        if (!startCharacters) return false;

        const endLines = get(startCharacters, start.character);
        if (!endLines) return false;

        const endCharacters = get(endLines, end.line);
        if (!endCharacters) return false;

        if (remove(endCharacters, end.character)) {
            this._size--;
            if (isEmpty(endCharacters)) {
                remove(endLines, end.line);
                if (isEmpty(endLines)) {
                    remove(startCharacters, start.character);
                    if (isEmpty(startCharacters)) {
                        remove(this._ranges, start.line);
                    }
                }
            }
            return true;
        }
        return false;
    }

    clear() {
        this._ranges.length = 0;
        this._size = 0;
    }

    forEach(cb: (value: T, key: Range, map: RangeMap<T>) => void, thisArg?: any) {
        for (const [key, value] of this) {
            cb.call(thisArg, value, key, this);
        }
    }

    * keys(): Generator<Range, void> {
        for (let startLine = 0; startLine < this._ranges.length; startLine++) {
            if (!(startLine in this._ranges)) {
                continue;
            }
            const startCharacters = this._ranges[startLine];
            for (let startCharacter = 0; startCharacter < startCharacters.length; startCharacter++) {
                if (!(startCharacter in startCharacters)) {
                    continue;
                }
                const endLines = startCharacters[startCharacter];
                for (let endLine = startLine; endLine < endLines.length; endLine++) {
                    if (!(endLine in endLines)) {
                        continue;
                    }
                    const endCharacters = endLines[endLine];
                    for (let endCharacter = endLine === startLine ? startCharacter : 0; endCharacter < endCharacters.length; endCharacter++) {
                        if (!(endCharacter in endCharacters)) {
                            continue;
                        }
                        const [key] = endCharacters[endCharacter];
                        yield key;
                    }
                }
            }
        }
    }

    * values(): Generator<T, void> {
        for (let startLine = 0; startLine < this._ranges.length; startLine++) {
            if (!(startLine in this._ranges)) {
                continue;
            }
            const startCharacters = this._ranges[startLine];
            for (let startCharacter = 0; startCharacter < startCharacters.length; startCharacter++) {
                if (!(startCharacter in startCharacters)) {
                    continue;
                }
                const endLines = startCharacters[startCharacter];
                for (let endLine = startLine; endLine < endLines.length; endLine++) {
                    if (!(endLine in endLines)) {
                        continue;
                    }
                    const endCharacters = endLines[endLine];
                    for (let endCharacter = endLine === startLine ? startCharacter : 0; endCharacter < endCharacters.length; endCharacter++) {
                        if (!(endCharacter in endCharacters)) {
                            continue;
                        }
                        const [, value] = endCharacters[endCharacter];
                        yield value;
                    }
                }
            }
        }
    }

    * entries(): Generator<[Range, T], void> {
        for (let startLine = 0; startLine < this._ranges.length; startLine++) {
            if (!(startLine in this._ranges)) {
                continue;
            }
            const startCharacters = this._ranges[startLine];
            for (let startCharacter = 0; startCharacter < startCharacters.length; startCharacter++) {
                if (!(startCharacter in startCharacters)) {
                    continue;
                }
                const endLines = startCharacters[startCharacter];
                for (let endLine = startLine; endLine < endLines.length; endLine++) {
                    if (!(endLine in endLines)) {
                        continue;
                    }
                    const endCharacters = endLines[endLine];
                    for (let endCharacter = endLine === startLine ? startCharacter : 0; endCharacter < endCharacters.length; endCharacter++) {
                        if (!(endCharacter in endCharacters)) {
                            continue;
                        }
                        const [key, value] = endCharacters[endCharacter];
                        yield [key, value];
                    }
                }
            }
        }
    }

    [Symbol.iterator]() {
        return this.entries();
    }

    /**
     * Find all entries containing the provided range.
     */
    * findAllContaining(positionOrRange: Position | Range): Generator<[Range, T], void> {
        const range = toRange(positionOrRange), { start, end } = range;

        // Since all entries must contain the range, all entry starts must occur on or before the range start
        startLoop: for (let startLine = 0; startLine < this._ranges.length; startLine++) {
            if (lineIsAfter(startLine, start)) {
                break;
            }
            if (!(startLine in this._ranges)) {
                continue;
            }
            const startCharacters = this._ranges[startLine];
            for (let startCharacter = 0; startCharacter < startCharacters.length; startCharacter++) {
                if (characterIsAfter(startLine, startCharacter, start)) {
                    break startLoop;
                }
                if (!(startCharacter in startCharacters)) {
                    continue;
                }
                const endLines = startCharacters[startCharacter];
                // Since all entries must contain the range, all entry ends must occur on or after the range end
                for (let endLine = end.line; endLine < endLines.length; endLine++) {
                    if (!(endLine in endLines)) {
                        continue;
                    }
                    const endCharacters = endLines[endLine];
                    for (let endCharacter = endLine === end.line ? end.character : 0; endCharacter < endCharacters.length; endCharacter++) {
                        if (!(endCharacter in endCharacters)) {
                            continue;
                        }
                        const [key, value] = endCharacters[endCharacter];
                        if (key.contains(range)) {
                            yield [key, value];
                        }
                    }
                }
            }
        }
    }

    /**
     * Find the entry with the least start position whose range contains the provided range.
     */
    findLeastContaining(positionOrRange: Position | Range): [Range, T] | undefined {
        for (const entry of this.findAllContaining(positionOrRange)) {
            return entry;
        }
    }

    /**
     * Find the entry with start and end positions whose range most closely contains the provided range, first by start, and then by end.
     */
    findNearestContaining(positionOrRange: Position | Range): [Range, T] | undefined {
        const range = toRange(positionOrRange), { start, end } = range;

        // Since all entries must contain the range, all entry starts must occur on or before the range start
        for (let startLine = Math.min(start.line, this._ranges.length - 1); startLine >= 0; startLine--) {
            if (!(startLine in this._ranges)) {
                continue;
            }
            const startCharacters = this._ranges[startLine];
            for (let startCharacter = startLine === start.line ? start.character : startCharacters.length - 1; startCharacter >= 0; startCharacter--) {
                if (!(startCharacter in startCharacters)) {
                    continue;
                }
                const endLines = startCharacters[startCharacter];
                // Since all entries must contain the range, all entry ends must occur on or after the range end
                for (let endLine = end.line; endLine <= endLines.length; endLine++) {
                    if (!(endLine in endLines)) {
                        continue;
                    }
                    const endCharacters = endLines[endLine];
                    for (let endCharacter = endLine === end.line ? end.character : 0; endCharacter < endCharacters.length; endCharacter++) {
                        if (!(endCharacter in endCharacters)) {
                            continue;
                        }
                        const [key, value] = endCharacters[endCharacter];
                        if (key.contains(range)) {
                            return [key, value];
                        }
                    }
                }
            }
        }
    }

    /**
     * Find all entries that are contained within the provided range.
     */
    * findAllContainedBy(range: Range): Generator<[Range, T], void> {
        const { start, end } = range;

        // Since all entries must be contained within the range, all entry starts must occur on or after the range start
        for (let startLine = start.line, l = this._ranges.length; startLine < l; startLine++) {
            if (lineIsAfter(startLine, end)) {
                break;
            }
            if (!(startLine in this._ranges)) {
                continue;
            }
            const startCharacters = this._ranges[startLine];
            for (let startCharacter = startLine === start.line ? start.character : 0, l = startCharacters.length; startCharacter < l; startCharacter++) {
                if (characterIsAfter(startLine, startCharacter, end)) {
                    break;
                }
                if (!(startCharacter in startCharacters)) {
                    continue;
                }
                const endLines = startCharacters[startCharacter];
                endLoop: for (let endLine = startLine, l = endLines.length; endLine < l; endLine++) {
                    if (lineIsAfter(endLine, end)) {
                        break;
                    }
                    if (!(endLine in endLines)) {
                        continue;
                    }
                    const endCharacters = endLines[endLine];
                    for (let endCharacter = endLine === startLine ? startCharacter : 0, l = endCharacters.length; endCharacter < l; endCharacter++) {
                        if (characterIsAfter(endLine, endCharacter, end)) {
                            break endLoop;
                        }
                        if (!(endCharacter in endCharacters)) {
                            continue;
                        }
                        const [key, value] = endCharacters[endCharacter];
                        if (range.contains(key)) {
                            yield [key, value];
                        }
                    }
                }
            }
        }
    }

    /**
     * Find the entry with the least start position whose range is contained by the provided range.
     */
    findLeastContainedBy(range: Range): [Range, T] | undefined {
        for (const entry of this.findAllContainedBy(range)) {
            return entry;
        }
    }

    /**
     * Find all entries that intersect with the provided range.
     */
    * findAllIntersecting(positionOrRange: Position | Range): Generator<[Range, T], void> {
        const range = toRange(positionOrRange), { start, end } = range;

        // Since all entries must intersect with the range, all entry starts must occur on or before the range end
        startLoop: for (let startLine = 0; startLine < this._ranges.length; startLine++) {
            if (lineIsAfter(startLine, end)) {
                break;
            }
            if (!(startLine in this._ranges)) {
                continue;
            }
            const startCharacters = this._ranges[startLine];
            for (let startCharacter = 0; startCharacter < startCharacters.length; startCharacter++) {
                if (characterIsAfter(startLine, startCharacter, end)) {
                    break startLoop;
                }
                if (!(startCharacter in startCharacters)) {
                    continue;
                }
                const endLines = startCharacters[startCharacter];
                // Since all entries must intersect with the range, all entry ends must occur on or after the range start
                for (let endLine = Math.max(start.line, startLine); endLine < endLines.length; endLine++) {
                    if (!(endLine in endLines)) {
                        continue;
                    }
                    const endCharacters = endLines[endLine];
                    for (let endCharacter = endLine === start.line ? start.character : 0; endCharacter < endCharacters.length; endCharacter++) {
                        if (!(endCharacter in endCharacters)) {
                            continue;
                        }
                        const [key, value] = endCharacters[endCharacter];
                        if (intersects(key, range)) {
                            yield [key, value];
                        }
                    }
                }
            }
        }
    }

    /**
     * Find the entry with the least start position whose range intersects with the provided range.
     */
    findLeastIntersecting(positionOrRange: Position | Range): [Range, T] | undefined {
        for (const entry of this.findAllIntersecting(positionOrRange)) {
            return entry;
        }
    }
}

function get<T>(map: T[], index: number): T | undefined {
    return index < map.length ? map[index] : undefined;
}

function isEmpty<T>(ar: T[]) {
    return ar.length === 0;
}

function remove<T>(ar: T[], index: number) {
    if (index < ar.length) {
        delete ar[index];
        let i: number;
        for (i = ar.length - 1; i >= 0; i--) {
            if (i in ar) {
                break;
            }
        }
        ar.length = i + 1;
        return true;
    }
    return false;
}

function findPosition<T>(map: LineMap<T>, position: Position) {
    const chars = get(map, position.line);
    return chars && get(chars, position.character);
}

function ensureCharactersForLine<T>(map: LineMap<T>, position: Position) {
    let characters = get(map, position.line);
    if (!characters) map[position.line] = characters = [];
    return characters;
}

function ensureLinesForCharacter<T>(map: EndLineMap<T>, position: Position) {
    let characters = get(map, position.character);
    if (!characters) map[position.character] = characters = [];
    return characters;
}

function toRange(positionOrRange: Position | Range) {
    return positionOrRange instanceof Range ? positionOrRange : new Range(positionOrRange, positionOrRange);
}

function intersects(left: Range, right: Range) {
    return left.start.isBeforeOrEqual(right.end) && left.end.isAfterOrEqual(right.start);
}

function lineIsAfter(line: number, position: Position) {
    return line > position.line;
}

function characterIsAfter(line: number, character: number, position: Position) {
    return line > position.line || line === position.line && character > position.character;
}
