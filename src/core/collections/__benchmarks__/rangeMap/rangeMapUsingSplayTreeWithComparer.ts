// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { SplayTree } from "#v8/tools/__benchmarks__/splaytree/splaytreeWithComparer.js";
import { Position, Range } from "vscode";

/**
 * Maps a {@link Range} to a value.
 *
 * Entries in a `RangeMap` are ordered by `range.start` (ascending), then `range.end` (descending)
 */
export class RangeMap<T> {
    private _ranges = new SplayTree<Range, T>(compareRanges);
    private _size = 0;

    get size() {
        return this._size;
    }

    has(range: Range) {
        return this._ranges.find(range) !== null;
    }

    get(range: Range) {
        return this._ranges.find(range)?.value;
    }

    set(range: Range, value: T) {
        const entry = this._ranges.find(range);
        if (entry !== null) {
            entry.value = value;
        }
        else {
            this._ranges.insert(range, value);
        }
        return this;
    }

    delete(range: Range) {
        return this._ranges.remove(range) !== null;
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

    keys(): Generator<Range, void> {
        return this._ranges.keys();
    }

    values(): Generator<T, void> {
        return this._ranges.values();
    }

    entries(): Generator<[Range, T], void> {
        return this._ranges.entries();
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
        let next: SplayTree.Node<Range, T> | null = null;
        for (let node = this._ranges.findMin(); node; node = next ?? node.next, next = null) {
            const key = node.key;
            if (key.start.isAfter(start)) {
                break;
            }
            if (key.end.isBefore(end)) {
                next = this._ranges.findLeastGreaterThan(key.with(key.start, key.start));
                if (next === node) {
                    next = null;
                }
                continue;
            }
            yield [key, node.value];
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
        const range = toRange(positionOrRange);

        // Since all entries must contain the range, all entry starts must occur on or before the range start
        const max = this._ranges.findGreatestLessThan(range);
        if (max) {
            if (max.key.contains(range)) {
                return [max.key, max.value];
            }
        }
    }

    /**
     * Find all entries that are contained within the provided range.
     */
    * findAllContainedBy(range: Range): Generator<[Range, T], void> {
        const { end } = range;

        // Since all entries must be contained within the range, all entry starts must occur on or after the range start
        const min = this._ranges.findGreatestLessThan(range);
        for (let node = min; node; node = node.next) {
            if (node.key.start.isAfter(end)) {
                break;
            }
            if (range.contains(node.key)) {
                yield [node.key, node.value];
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
        const range = toRange(positionOrRange), { end } = range;

        // Since all entries must intersect with the range, all entry starts must occur on or before the range end
        for (let node = this._ranges.findMin(); node; node = node.next) {
            if (node.key.start.isAfter(end)) {
                break;
            }
            if (intersects(node.key, range)) {
                yield [node.key, node.value];
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

function compareNumbers(a: number, b: number) {
    return a < b ? -1 : a > b ? 1 : 0;
}

function comparePositions(a: Position, b: Position) {
    return compareNumbers(a.line, b.line) || compareNumbers(a.character, b.character);
}

function compareRanges(a: Range, b: Range) {
    return comparePositions(a.start, b.start) || -comparePositions(a.end, b.end);
}

function toRange(positionOrRange: Position | Range) {
    return positionOrRange instanceof Range ? positionOrRange : new Range(positionOrRange, positionOrRange);
}

function intersects(left: Range, right: Range) {
    return left.start.isBeforeOrEqual(right.end) && left.end.isAfterOrEqual(right.start);
}
