import { benchmark } from "#benchmarks";
import { generate } from "@esfx/iter-fn";
import * as vscode from "vscode";
import { LocationMap as LocationMap } from "../locationMap";
import { LocationMap as LocationMapUsingMapRangeMap } from "./locationMap/locationMapUsingMapRangeMap";
import { LocationMap as LocationMapUsingMaps } from "./locationMap/locationMapUsingMaps";
import { LocationMap as LocationMapUsingSplayTreeRangeMap } from "./locationMap/locationMapUsingSplayTreeRangeMap";
import { LocationMap as LocationMapUsingMapRangeMapUsingSplayTreeWithComparer } from "./locationMap/locationMapUsingMapRangeMapUsingSplayTreeWithComparer";
import { randomBoolean, randomElement, randomLocation, randomUri } from "./random";

interface LocationMapLike<T> {
    get size(): number;
    has(key: vscode.Location): boolean;
    get(key: vscode.Location): T | undefined;
    set(key: vscode.Location, value: T): this;
    delete(key: vscode.Location): boolean;
    clear(): void;
    forEach(cb: (value: T, key: vscode.Location, map: LocationMapLike<T>) => unknown, thisArg?: unknown): void;
    keys(): Generator<vscode.Location, void, unknown>;
    values(): Generator<T, void, unknown>;
    entries(): Generator<[vscode.Location, T], void, unknown>;
    [Symbol.iterator](): Generator<[vscode.Location, T], void, unknown>;
}

describe("locationMap", () => {
    const rangeCount = 1000;
    const uriCount = 50;
    const collapsedRangePopulation = .2;
    const totalPopulation = .2;
    const missPopulation = .05;

    const implementations: { name: string, LocationMap: new <T>() => LocationMapLike<T>, locationMap: LocationMapLike<number> }[] = [
        { name: "current", LocationMap, locationMap: undefined! },
        { name: "Map ×5", LocationMap: LocationMapUsingMaps, locationMap: undefined! },
        { name: "SplayTree ×5", LocationMap: LocationMapUsingSplayTreeRangeMap, locationMap: undefined! },
        { name: "Map->SplayTree ×4", LocationMap: LocationMapUsingMapRangeMap, locationMap: undefined! },
        { name: "Map->SplayTreeWithComparer", LocationMap: LocationMapUsingMapRangeMapUsingSplayTreeWithComparer, locationMap: undefined! },
    ];

    describe(`set() ${rangeCount} elements`, () => {
        let entries: (readonly [vscode.Location, number])[];

        afterAll(() => {
            entries = undefined!;
        });

        beforeAll(() => {
            const uris = [...generate(uriCount, () => randomUri())];
            entries = [...generate(rangeCount, i => [randomLocation({ uris, collapseChance: collapsedRangePopulation }), i] as const)];
        });

        benchmark.each(implementations)("$name", ({ LocationMap }) => {
            const map = new LocationMap<number>();
            for (let i = 0; i < entries.length; i++) {
                map.set(entries[i][0], entries[i][1]);
            }
        });
    });

    describe(`get() ${(totalPopulation * 100).toFixed(1)}% of ${rangeCount} elements w/${(missPopulation * 100).toFixed(1)}% miss`, () => {
        let entries: (readonly [vscode.Location, number])[];
        let keys: vscode.Location[];

        afterAll(() => {
            entries = undefined!;
            keys = undefined!;
            for (const implementation of implementations) {
                implementation.locationMap = undefined!;
            }
        });

        beforeAll(() => {
            const uris = [...generate(uriCount, () => randomUri())];
            entries = [...generate(rangeCount, i => [randomLocation({ uris, collapseChance: collapsedRangePopulation }), i] as const)];
            for (const implementation of implementations) {
                implementation.locationMap = new implementation.LocationMap<number>();
                for (let i = 0; i < entries.length; i++) {
                    implementation.locationMap.set(entries[i][0], entries[i][1]);
                }
            }
            const keyCount = Math.floor(rangeCount * totalPopulation) + Math.floor(rangeCount * missPopulation);
            keys = Array.from({ length: keyCount }).map(() => randomElement(entries, missPopulation)?.[0]
                ?? randomLocation({ uris: randomBoolean(missPopulation) ? undefined : uris }));
        });

        benchmark.each(implementations)("$name", ({ locationMap }) => {
            locationMap.get(randomElement(keys));
        }, { minSamples: 200 });
    });
});
