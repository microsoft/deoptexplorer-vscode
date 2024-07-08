// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { SplayTree } from "#v8/tools/__benchmarks__/splaytree/splaytreeNoComparer.js";
import { Position, Range } from "vscode";

type CharacterTree<T> = SplayTree<number, T>;
type CharacterNode<T> = SplayTree.Node<number, T>;
type LineTree<T> = SplayTree<number, CharacterTree<T>>;
type LineNode<T> = SplayTree.Node<number, CharacterTree<T>>;
type EndLineTree<T> = LineTree<[Range, T]>;
type StartLineTree<T> = LineTree<EndLineTree<T>>;

/**
 * Maps a {@link Range} to a value.
 */
export class RangeMap<T> {
    // startLine -> startCharacter -> endLine -> endCharacter -> T
    private _ranges: StartLineTree<T> = new SplayTree();
    private _size: number = 0;

    get size() {
        return this._size;
    }

    has(range: Range) {
        const { start, end } = range;
        const entry = findPosition(this._ranges, start)?.value;
        if (entry) {
            return !!findPosition(entry, end);
        }
        return false;
    }

    get(key: Range) {
        const { start, end } = key;
        const entry = findPosition(this._ranges, start)?.value;
        if (entry) {
            return findPosition(entry, end)?.value[1];
        }
    }

    /**
     * Find all entries containing the provided range.
     */
    * findAllContaining(positionOrRange: Position | Range): Generator<[Range, T], void> {
        const range = toRange(positionOrRange), { start, end } = range;

        // Since all entries must contain the range, all entry starts must occur on or before the range start
        startLoop: for (const startLine of iterateAscending(least(this._ranges))) {
            if (lineIsAfter(startLine, start)) {
                break;
            }
            for (const startCharacter of iterateAscending(least(startLine.value))) {
                if (characterIsAfter(startLine, startCharacter, start)) {
                    break startLoop;
                }
                // Since all entries must contain the range, all entry ends must occur on or after the range end
                for (const endLine of iterateAscending(leastLineGreaterThan(startCharacter.value, end))) {
                    for (const endCharacter of iterateAscending(leastCharacterGreaterThan(endLine, end))) {
                        const [key, value] = endCharacter.value;
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
     * Find the entry with the start and end positions whose range most closely contains the provided range.
     */
    findNearestContaining(positionOrRange: Position | Range): [Range, T] | undefined {
        const range = toRange(positionOrRange), { start, end } = range;

        // Since all entries must contain the range, all entry starts must occur on or before the range start
        for (const startLine of iterateDescending(greatestLineLessThan(this._ranges, start))) {
            for (const startCharacter of iterateDescending(greatestCharacterLessThan(startLine, start))) {
                // Since all entries must contain the range, all entry ends must occur on or after the range end
                for (const endLine of iterateAscending(leastLineGreaterThan(startCharacter.value, end))) {
                    for (const endCharacter of iterateAscending(leastCharacterGreaterThan(endLine, end))) {
                        const [key, value] = endCharacter.value;
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
        for (const startLine of iterateAscending(leastLineGreaterThan(this._ranges, start))) {
            if (lineIsAfter(startLine, end)) {
                break;
            }
            for (const startCharacter of iterateAscending(leastCharacterGreaterThan(startLine, start))) {
                if (characterIsAfter(startLine, startCharacter, end)) {
                    break;
                }
                // Since all entries must be contained within the range, all entry ends must occur on or before the
                // range end
                const endLines = startCharacter.value;
                endLoop: for (const endLine of iterateAscending(least(endLines))) {
                    if (lineIsAfter(endLine, end)) {
                        break;
                    }
                    const endCharacters = endLine.value;
                    for (const endCharacter of iterateAscending(least(endCharacters))) {
                        if (characterIsAfter(endLine, endCharacter, end)) {
                            break endLoop;
                        }
                        const [key, value] = endCharacter.value;
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
        startLoop: for (const startLine of iterateAscending(least(this._ranges))) {
            if (lineIsAfter(startLine, end)) {
                break;
            }
            const startCharacters = startLine.value;
            for (const startCharacter of iterateAscending(least(startCharacters))) {
                if (characterIsAfter(startLine, startCharacter, end)) {
                    break startLoop;
                }
                // Since all entries must intersect with the range, all entry ends must occur on or after the range start
                const endLines = startCharacter.value;
                for (const endLine of iterateAscending(leastLineGreaterThan(endLines, start))) {
                    for (const endCharacter of iterateAscending(leastCharacterGreaterThan(endLine, start))) {
                        const [key, value] = endCharacter.value;
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

    set(key: Range, value: T) {
        const { start, end } = key;
        const startCharacters = ensureCharactersForLine(this._ranges, start);
        const endLines = ensureLinesForCharacter(startCharacters, start);
        const endCharacters = ensureCharactersForLine(endLines, end);
        let entry = endCharacters.find(end.character)?.value;
        if (!entry) {
            endCharacters.insert(end.character, [key, value]);
            this._size++;
        }
        else {
            entry[1] = value;
        }
        return this;
    }

    delete(key: Range) {
        const { start, end } = key;

        const startCharacters = this._ranges.find(start.line)?.value;
        if (!startCharacters) return false;

        const endLines = startCharacters.find(start.character)?.value;
        if (!endLines) return false;

        const endCharacters = endLines.find(end.line)?.value;
        if (!endCharacters) return false;

        if (endCharacters.find(end.character)) {
            endCharacters.remove(end.character);
            this._size--;
            if (endCharacters.isEmpty()) {
                endLines.remove(end.line);
                if (endLines.isEmpty()) {
                    startCharacters.remove(start.character);
                    if (startCharacters.isEmpty()) {
                        this._ranges.remove(start.line);
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

    * keys(): Generator<Range, void> {
        for (const { value: startCharacters } of iterateAscending(least(this._ranges))) {
            for (const { value: endLines } of iterateAscending(least(startCharacters))) {
                for (const { value: endCharacters } of iterateAscending(least(endLines))) {
                    for (const { value: [key] } of iterateAscending(least(endCharacters))) {
                        yield key;
                    }
                }
            }
        }
    }

    * values(): Generator<T, void> {
        for (const { value: startCharacters } of iterateAscending(least(this._ranges))) {
            for (const { value: endLines } of iterateAscending(least(startCharacters))) {
                for (const { value: endCharacters } of iterateAscending(least(endLines))) {
                    for (const { value: [, value] } of iterateAscending(least(endCharacters))) {
                        yield value;
                    }
                }
            }
        }
    }

    * entries(): Generator<[Range, T], void> {
        for (const { value: startCharacters } of iterateAscending(least(this._ranges))) {
            for (const { value: endLines } of iterateAscending(least(startCharacters))) {
                for (const { value: endCharacters } of iterateAscending(least(endLines))) {
                    for (const { value: [key, value] } of iterateAscending(least(endCharacters))) {
                        yield [key, value];
                    }
                }
            }
        }
    }

    [Symbol.iterator]() {
        return this.entries();
    }
}

function findPosition<T>(tree: LineTree<T>, position: Position) {
    return tree.find(position.line)?.value.find(position.character);
}

function ensureCharactersForLine<T>(tree: LineTree<T>, position: Position) {
    let characters = tree.find(position.line)?.value;
    if (!characters) tree.insert(position.line, characters = new SplayTree());
    return characters;
}

function ensureLinesForCharacter<T>(tree: CharacterTree<LineTree<T>>, position: Position) {
    let characters = tree.find(position.character)?.value;
    if (!characters) tree.insert(position.character, characters = new SplayTree());
    return characters;
}

function toRange(positionOrRange: Position | Range) {
    return positionOrRange instanceof Range ? positionOrRange : new Range(positionOrRange, positionOrRange);
}

function intersects(left: Range, right: Range) {
    return left.start.isBeforeOrEqual(right.end) && left.end.isAfterOrEqual(right.start);
}

function lineIsAfter<T>(line: LineNode<T>, position: Position) {
    return line.key > position.line;
}

function characterIsAfter<T>(line: LineNode<T>, character: CharacterNode<T>, position: Position) {
    return line.key > position.line || line.key === position.line && character.key > position.character;
}

function greatest<T>(tree: SplayTree<number, T>) {
    return tree.findGreatestLessThan(Infinity);
}

function greatestLineLessThan<T>(tree: LineTree<T>, position: Position) {
    return tree.findGreatestLessThan(position.line);
}

function greatestCharacterLessThan<T>(node: LineNode<T>, position: Position) {
    return node.key === position.line ?
        node.value.findGreatestLessThan(position.character) :
        greatest(node.value);
}

function least<T>(tree: SplayTree<number, T>) {
    return tree.findLeastGreaterThan(0);
}

function leastLineGreaterThan<T>(tree: LineTree<T>, position: Position) {
    return tree.findLeastGreaterThan(position.line);
}

function leastCharacterGreaterThan<T>(node: LineNode<T>, position: Position) {
    return node.key === position.line ?
        node.value.findLeastGreaterThan(position.character) :
        least(node.value);
}

/**
 * Iterate splay tree nodes starting at `node` whose keys are greater than or equal to `node.key`.
 */
function * iterateDescending<T>(node: SplayTree.Node<number, T> | null): Generator<SplayTree.Node<number, T>, void> {
    if (node) {
        yield node;
        yield* iterateWorker(node.left, true);
    }
}

/**
 * Iterate splay tree nodes starting at `node` whose keys are greater than or equal to `node.key`.
 */
function * iterateAscending<T>(node: SplayTree.Node<number, T> | null): Generator<SplayTree.Node<number, T>, void> {
    if (node) {
        yield node;
        yield* iterateWorker(node.right, false);
    }
}

/**
 * Iterate an entire splay tree node.
 */
function * iterateWorker<T>(node: SplayTree.Node<number, T> | null, descending: boolean): Generator<SplayTree.Node<number, T>, void> {
    if (node) {
        yield* iterateWorker(descending ? node.right : node.left, descending);
        yield node;
        yield* iterateWorker(descending ? node.left : node.right, descending);
    }
}
