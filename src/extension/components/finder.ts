// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Position } from "vscode";
import { CanonicalUri } from "../services/canonicalPaths";
import type { Entry } from "../model/entry";

/**
 * Creates a function that can be used to find related entries in a file by position.
 * @param file The file containing the entries.
 * @param entries The entries in the file.
 * @returns A function that finds entries containing the provided position.
 */
export function createFinder(file: CanonicalUri, entries: Entry[]) {
    interface PositionInfo {
        position: Position;
        index: number;
    }

    const localEntries = entries.slice();
    const ranges = localEntries.map(entry => entry.pickReferenceLocation(file).range);
    const starts: PositionInfo[] = [];
    const ends: PositionInfo[] = [];
    let lastStart: PositionInfo | undefined;
    let lastEnd: PositionInfo | undefined;
    for (let i = 0; i < ranges.length; i++) {
        const { start, end } = ranges[i];
        if (!lastStart || !lastStart.position.isEqual(start)) {
            starts.push(lastStart = { position: start, index: i });
        }
        if (!lastEnd || !lastEnd.position.isEqual(end)) {
            ends.push(lastEnd = { position: end, index: i });
        }
        else {
            lastEnd.index = i;
        }
    }

    return find;

    // returns the index of the first range that starts *after* the position.
    function findLeastUpperBound(position: Position) {
        for (let i = 0; i < starts.length; i++) {
            if (starts[i].position.isAfter(position)) {
                return starts[i].index;
            }
        }
        return ranges.length;
    }

    // returns the index of the range following the range that ends *before* the position.
    function findGreatestLowerBound(position: Position) {
        for (let i = ends.length - 1; i >= 0; i--) {
            if (ends[i].position.isBefore(position)) {
                return ends[i].index + 1;
            }
        }
        return 0;
    }

    function* find(position: Position) {
        if (localEntries.length === 0) return;
        const end = findLeastUpperBound(position);
        const start = findGreatestLowerBound(position);
        if (end - start <= 0) return;

        for (let i = start; i < end; i++) {
            if (ranges[i].contains(position)) {
                yield localEntries[i];
            }
        }
    }
}