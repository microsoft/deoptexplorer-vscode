import { benchmark } from "#benchmarks";
import { generate } from "@esfx/iter-fn";
import { from } from "@esfx/iter-query";
import * as vscode from "vscode";
import { RangeMap } from "../rangeMap";
import { randomBoolean, randomElement, randomRange } from "./random";
import { RangeMap as RangeMapUsingMaps } from "./rangeMap/rangeMapUsingMaps";
import { RangeMap as RangeMapUsingSparseArrays } from "./rangeMap/rangeMapUsingSparseArrays";
import { RangeMap as RangeMapUsingSplayTreesLessDepth } from "./rangeMap/rangeMapUsingSplayTreesLessDepth";
import { RangeMap as RangeMapUsingSplayTreesLessPolymorphism } from "./rangeMap/rangeMapUsingSplayTreesLessPolymorphism";
import { RangeMap as RangeMapUsingSplayTreeWithComparer } from "./rangeMap/rangeMapUsingSplayTreeWithComparer";

interface RangeMapLike<T> {
    get size(): number;
    has(range: vscode.Range): boolean;
    get(key: vscode.Range): T | undefined;
    findAllContaining(positionOrRange: vscode.Position | vscode.Range): Generator<[vscode.Range, T], void>;
    findLeastContaining(positionOrRange: vscode.Position | vscode.Range): [vscode.Range, T] | undefined;
    findNearestContaining(positionOrRange: vscode.Position | vscode.Range): [vscode.Range, T] | undefined;
    findAllContainedBy(range: vscode.Range): Generator<[vscode.Range, T], void>;
    findLeastContainedBy(range: vscode.Range): [vscode.Range, T] | undefined;
    findAllIntersecting(positionOrRange: vscode.Position | vscode.Range): Generator<[vscode.Range, T], void>;
    findLeastIntersecting(positionOrRange: vscode.Position | vscode.Range): [vscode.Range, T] | undefined;
    set(key: vscode.Range, value: T): this;
    delete(key: vscode.Range): boolean;
    clear(): void;
    forEach(cb: (value: T, key: vscode.Range, map: RangeMapLike<T>) => void, thisArg?: any): void;
    keys(): Generator<vscode.Range, void>;
    values(): Generator<T, void>;
    entries(): Generator<[vscode.Range, T], void>;
    [Symbol.iterator](): Generator<[vscode.Range, T], void, unknown>;
}

describe("rangeMap", () => {
    const count = 1000;
    const collapseChance = .2;
    const getPercent = .2;
    const missPercent = .05;
    const findAllRangePercent = .3;

    const implementations: { name: string, RangeMap: new <T>() => RangeMapLike<T>, rangeMap: RangeMapLike<number> }[] = [
        { name: `current`, RangeMap: RangeMap, rangeMap: undefined!, },
        { name: `SplayTree x4 (less depth)`, RangeMap: RangeMapUsingSplayTreesLessDepth, rangeMap: undefined!, },
        { name: `SplayTree ×4 (less polymorphism)`, RangeMap: RangeMapUsingSplayTreesLessPolymorphism, rangeMap: undefined!, },
        { name: `Map x4`, RangeMap: RangeMapUsingMaps, rangeMap: undefined!, },
        { name: `Sparse Array x4`, RangeMap: RangeMapUsingSparseArrays, rangeMap: undefined!, },
        { name: `SplayTreeWithComparer`, RangeMap: RangeMapUsingSplayTreeWithComparer, rangeMap: undefined! },
    ];

    describe(`set() ${count} elements`, () => {
        let entries: (readonly [vscode.Range, number])[];

        beforeAll(() => { entries = [...generate(count, (i) => [randomRange({ collapseChance }), i] as const)]; });
        afterAll(() => { entries = undefined!; });

        benchmark.each(implementations)("$name", ({ RangeMap }) => {
            const map = new RangeMap<number>();
            for (let i = 0; i < entries.length; i++) {
                map.set(entries[i][0], entries[i][1]);
            }
        });
    });

    describe(`get() of ${count} elements w/${(missPercent * 100).toFixed(1)}% miss`, () => {
        let entries: (readonly [vscode.Range, number])[];
        let selectedKeys: vscode.Range[];

        afterAll(() => {
            entries = undefined!;
            selectedKeys = undefined!;
            for (const implementation of implementations) {
                implementation.rangeMap = undefined!;
            }
        });

        beforeAll(() => {
            entries = [...generate(count, (i) => [randomRange({ collapseChance }), i] as const)];
            for (const implementation of implementations) {
                const map = new implementation.RangeMap<number>();
                for (let i = 0; i < entries.length; i++) {
                    map.set(entries[i][0], entries[i][1]);
                }
                implementation.rangeMap = map;
            }
            const keyCount = Math.floor(count * getPercent) + Math.floor(count * missPercent);
            selectedKeys = [...generate(keyCount, () => randomElement(entries, missPercent)?.[0] ?? randomRange({ collapseChance }))];
        });

        benchmark.each(implementations)("$name", ({ rangeMap }) => {
            rangeMap.get(randomElement(selectedKeys));
        });
    });

    describe(`findAllContaining() ${(findAllRangePercent * 100).toFixed(1)}% of ${count} elements w/${(missPercent * 100).toFixed(1)}% miss`, () => {
        let entries: (readonly [vscode.Range, number])[];
        let ranges: vscode.Range[];

        beforeAll(() => {
            entries = from(generate(count, () => randomRange({ collapseChance })))
                .orderBy(range => range.start.line)
                .thenBy(range => range.start.character)
                .thenBy(range => range.end.line)
                .thenBy(range => range.end.character)
                .map((range, i) => [range, i] as const)
                .toArray();
            const rangeCount = Math.floor(count * findAllRangePercent) + Math.floor(count * missPercent);
            ranges = from(generate(rangeCount, () => {
                if (randomBoolean(missPercent)) return randomRange({ collapseChance });
                const start = randomElement(entries)[0];
                const end = randomElement(entries)[0];
                return start.union(end);
            })).toArray();
            for (const implementation of implementations) {
                const map = new implementation.RangeMap<number>();
                for (let i = 0; i < entries.length; i++) {
                    map.set(entries[i][0], entries[i][1]);
                }
                implementation.rangeMap = map;
            }
        });

        afterAll(() => {
            entries = undefined!;
            ranges = undefined!;
            for (const implementation of implementations) {
                implementation.rangeMap = undefined!;
            }
        });

        const implementationsExceptSparseArray = implementations.filter(impl => impl.name !== "Sparse Array x4");
        benchmark.each(implementationsExceptSparseArray)("$name", ({ rangeMap }) => {
            let i = 0;
            for (const _ of rangeMap.findAllContaining(randomElement(ranges))) {
                if (i++ > 5) break;
            }
        }, {
            timeout: 120000,
        });
    });
});
