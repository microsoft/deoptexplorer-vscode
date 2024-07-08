// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import { Position, Range } from "vscode";

interface PosMap<T> extends Map<number, T> {
    orderedKeys?: number[];
}

type CharacterMap<T> = PosMap<T>;
type LineMap<T> = PosMap<CharacterMap<T>>;
type EndLineMap<T> = LineMap<[Range, T]>;
type StartLineMap<T> = LineMap<EndLineMap<T>>;

export class RangeMap<T> {
    private _ranges: StartLineMap<T> = new Map();
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
        let entry = endCharacters.get(end.character);
        if (!entry) {
            this._size++;
            endCharacters.set(end.character, [key, value]);
        }
        else {
            entry[1] = value;
        }

        return this;
    }

    delete(key: Range) {
        const { start, end } = key;

        const startCharacters = this._ranges.get(start.line);
        if (!startCharacters) return false;

        const endLines = startCharacters.get(start.character);
        if (!endLines) return false;

        const endCharacters = endLines.get(end.line);
        if (!endCharacters) return false;

        if (remove(endCharacters, end.character)) {
            this._size--;
            if (endCharacters.size === 0) {
                remove(endLines, end.line);
                if (endLines.size === 0) {
                    remove(startCharacters, start.character);
                    if (startCharacters.size === 0) {
                        remove(this._ranges, start.line);
                    }
                }
            }
            return true;
        }
        return false;
    }

    clear() {
        this._ranges.clear();
        this._size = 0;
    }

    forEach(cb: (value: T, key: Range, map: RangeMap<T>) => void, thisArg?: any) {
        for (const [key, value] of this) {
            cb.call(thisArg, value, key, this);
        }
    }

    * keys(): Generator<Range, void> {
        for (const startLine of orderedKeys(this._ranges)) {
            const startCharacters = this._ranges.get(startLine);
            if (!startCharacters) continue;
            for (const startCharacter of orderedKeys(startCharacters)) {
                const endLines = startCharacters.get(startCharacter);
                if (!endLines) continue;
                for (const endLine of orderedKeys(endLines)) {
                    const endCharacters = endLines.get(endLine);
                    if (!endCharacters) continue;
                    for (const endCharacter of orderedKeys(endCharacters)) {
                        const entry = endCharacters.get(endCharacter);
                        if (entry) {
                            const [key] = entry;
                            yield key;
                        }
                    }
                }
            }
        }
    }

    * values(): Generator<T, void> {
        for (const startLine of orderedKeys(this._ranges)) {
            const startCharacters = this._ranges.get(startLine);
            if (!startCharacters) continue;
            for (const startCharacter of orderedKeys(startCharacters)) {
                const endLines = startCharacters.get(startCharacter);
                if (!endLines) continue;
                for (const endLine of orderedKeys(endLines)) {
                    const endCharacters = endLines.get(endLine);
                    if (!endCharacters) continue;
                    for (const endCharacter of orderedKeys(endCharacters)) {
                        const entry = endCharacters.get(endCharacter);
                        if (entry) {
                            const [, value] = entry;
                            yield value;
                        }
                    }
                }
            }
        }
    }

    * entries(): Generator<[Range, T], void> {
        for (const startLine of orderedKeys(this._ranges)) {
            const startCharacters = this._ranges.get(startLine);
            if (!startCharacters) continue;
            for (const startCharacter of orderedKeys(startCharacters)) {
                const endLines = startCharacters.get(startCharacter);
                if (!endLines) continue;
                for (const endLine of orderedKeys(endLines)) {
                    const endCharacters = endLines.get(endLine);
                    if (!endCharacters) continue;
                    for (const endCharacter of orderedKeys(endCharacters)) {
                        const entry = endCharacters.get(endCharacter);
                        if (entry) {
                            const [key, value] = entry;
                            yield [key, value];
                        }
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
        startLoop: for (const [startLine, startCharacters] of iterateAscending(this._ranges)) {
            if (lineIsAfter(startLine, start)) {
                break;
            }
            for (const [startCharacter, endLines] of iterateAscending(startCharacters)) {
                if (characterIsAfter(startLine, startCharacter, start)) {
                    break startLoop;
                }
                // Since all entries must contain the range, all entry ends must occur on or after the range end
                for (const [endLine, endCharacters] of linesGreaterThanAscending(endLines, end)) {
                    for (const [, [key, value]] of charactersGreaterThanAscending(endLine, endCharacters, end)) {
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
        for (const [startLine, startCharacters] of linesLessThanDescending(this._ranges, start)) {
            for (const [, endLines] of charactersLessThanDescending(startLine, startCharacters, start)) {
                // Since all entries must contain the range, all entry ends must occur on or after the range end
                for (const [endLine, endCharacters] of linesGreaterThanAscending(endLines, end)) {
                    for (const [, [key, value]] of charactersGreaterThanAscending(endLine, endCharacters, end)) {
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
        for (const [startLine, startCharacters] of linesGreaterThanAscending(this._ranges, start)) {
            if (lineIsAfter(startLine, end)) {
                break;
            }
            for (const [startCharacter, endLines] of charactersGreaterThanAscending(startLine, startCharacters, start)) {
                if (characterIsAfter(startLine, startCharacter, end)) {
                    break;
                }
                // Since all entries must be contained within the range, all entry ends must occur on or before the
                // range end
                endLoop: for (const [endLine, endCharacters] of iterateAscending(endLines)) {
                    if (lineIsAfter(endLine, end)) {
                        break;
                    }
                    for (const [endCharacter, [key, value]] of iterateAscending(endCharacters)) {
                        if (characterIsAfter(endLine, endCharacter, end)) {
                            break endLoop;
                        }
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
        startLoop: for (const [startLine, startCharacters] of iterateAscending(this._ranges)) {
            if (lineIsAfter(startLine, end)) {
                break;
            }
            for (const [startCharacter, endLines] of iterateAscending(startCharacters)) {
                if (characterIsAfter(startLine, startCharacter, end)) {
                    break startLoop;
                }
                // Since all entries must intersect with the range, all entry ends must occur on or after the range start
                for (const [endLine, endCharacters] of linesGreaterThanAscending(endLines, start)) {
                    for (const [, [key, value]] of charactersGreaterThanAscending(endLine, endCharacters, start)) {
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

function set<T>(map: PosMap<T>, key: number, value: T) {
    const initialSize = map.size;
    map.set(key, value);
    if (map.size !== initialSize) {
        if (map.orderedKeys?.length) {
            if (key < map.orderedKeys[0]) {
                map.orderedKeys.unshift(key);
            }
            else if (key > map.orderedKeys[map.orderedKeys.length - 1]) {
                map.orderedKeys.push(key);
            }
            else {
                map.orderedKeys = undefined;
            }
        }
        else if (map.size === 1) {
            map.orderedKeys = [key];
        }
    }
}

function remove<T>(map: PosMap<T>, key: number) {
    if (map.delete(key)) {
        if (map.orderedKeys?.length) {
            if (key === map.orderedKeys[0]) {
                map.orderedKeys.shift();
            }
            else if (key === map.orderedKeys[map.orderedKeys.length - 1]) {
                map.orderedKeys.pop();
            }
            else {
                map.orderedKeys = undefined;
            }
        }
        return true;
    }
    return false;
}

function orderedKeys<T>(map: PosMap<T>) {
    return (map.orderedKeys ??= [...map.keys()].sort(ascendingOrder)).slice();
}

function ascendingOrder(a: number, b: number) {
    return a - b;
}

function findPosition<T>(map: LineMap<T>, position: Position) {
    return map.get(position.line)?.get(position.character);
}

function ensureCharactersForLine<T>(map: LineMap<T>, position: Position) {
    let characters = map.get(position.line);
    if (!characters) set(map, position.line, characters = new Map());
    return characters;
}

function ensureLinesForCharacter<T>(map: CharacterMap<LineMap<T>>, position: Position) {
    let characters = map.get(position.character);
    if (!characters) set(map, position.character, characters = new Map());
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

function entries<T>(map: PosMap<T>, descending: boolean, where?: (key: number) => boolean) {
    return from(descending ? orderedKeys(map).reverse() : orderedKeys(map))
        .through(q => where ? q.where(where) : q)
        .select(key => [key, map.get(key)] as [number, T | undefined])
        .where((entry): entry is [number, T] => entry[1] !== undefined);
}

function iterateAscending<T>(map: PosMap<T>, where?: (key: number) => boolean) {
    return entries(map, /*descending*/ false, where);
}

function iterateDescending<T>(map: PosMap<T>, where?: (key: number) => boolean) {
    return entries(map, /*descending*/ true, where);
}

function linesLessThanDescending<T>(map: PosMap<T>, position: Position) {
    return iterateDescending(map, key => key <= position.line);
}

function charactersLessThanDescending<T>(line: number, map: PosMap<T>, position: Position) {
    return iterateDescending(map, line === position.line ? key => key <= position.character : undefined);
}

function linesGreaterThanAscending<T>(map: PosMap<T>, position: Position) {
    return iterateAscending(map, key => key >= position.line);
}

function charactersGreaterThanAscending<T>(line: number, map: PosMap<T>, position: Position) {
    return iterateAscending(map, line === position.line ? key => key >= position.character : undefined);
}
