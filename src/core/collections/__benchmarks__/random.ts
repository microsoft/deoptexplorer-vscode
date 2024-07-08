// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Location, Position, Range, Uri } from "vscode";

const MAX_INT32 = (2 ** 31) - 1;
const MIN_INT32 = -(2 ** 31);

export interface MinMax {
    min?: number;
    max?: number;
}

export function randomInt({ min = MIN_INT32, max = MAX_INT32 }: MinMax = {}) {
    return Math.floor(Math.random() * (1 + max - min)) + min;
}

export function randomElement<T>(elements: readonly T[]): T;
export function randomElement<T>(elements: readonly T[], missChance?: number): T | undefined;
export function randomElement<T>(elements: readonly T[], missChance = 0) {
    if (elements.length === 0) throw new RangeError();
    if (missChance > 0 && randomBoolean(missChance)) return undefined;
    return elements[randomInt({ min: 0, max: elements.length - 1 })];
}

export function randomBoolean(trueChance = 0.5) {
    return Math.random() < trueChance;
}

export function randomPosition({ line, character }: { line?: MinMax, character?: MinMax } = {}) {
    return new Position(randomInt({ min: 0, ...line }), randomInt({ min: 0, ...character }));
}

export function randomRange({ line, character, collapseChance = 0 }: { line?: MinMax, character?: MinMax, collapseChance?: number } = {}) {
    const collapsed = randomBoolean(collapseChance);
    const start = randomPosition({ line, character });
    const end = collapsed ? start : randomPosition({ line, character });
    return new Range(start, end);
}

export function randomUri() {
    return Uri.parse(`uri:${randomInt({ min: 0 })}`);
}

export function randomLocation({ line, character, uris, collapseChance = 0 }: { line?: MinMax, character?: MinMax, uris?: readonly Uri[], collapseChance?: number } = {}) {
    const uri = uris?.length ? randomElement(uris) : randomUri();
    const range = randomRange({ line, character, collapseChance });
    return new Location(uri, range);
}
