import { Range } from "vscode";
import { RangeMap as RangeMapUsingMaps } from "../rangeMapUsingMaps";
import { RangeMap as RangeMapUsingSparseArrays } from "../rangeMapUsingSparseArrays";
import { RangeMap as RangeMapUsingSplayTreesLessDepth } from "../rangeMapUsingSplayTreesLessDepth";
import { RangeMap as RangeMapUsingSplayTreesLessPolymorphism } from "../rangeMapUsingSplayTreesLessPolymorphism";
import { RangeMap as RangeMapUsingSplayTreeWithComparer } from "../rangeMapUsingSplayTreeWithComparer";

const implementations = [
    { name: `SplayTree x4 (less depth)`, RangeMap: RangeMapUsingSplayTreesLessDepth },
    { name: `SplayTree ×4 (less polymorphism)`, RangeMap: RangeMapUsingSplayTreesLessPolymorphism },
    { name: `Map x4`, RangeMap: RangeMapUsingMaps },
    { name: `Sparse Array x4`, RangeMap: RangeMapUsingSparseArrays },
    { name: `SplayTreeWithComparer`, RangeMap: RangeMapUsingSplayTreeWithComparer },
];

describe("RangeMap variations", () => {
    describe.each(implementations)("$name", ({ RangeMap }) => {
        describe("findAllContaining", () => {
            it("when equal", () => {
                const map = new RangeMap();
                map.set(new Range(5, 0, 6, 10), 1);
                const entries = [...map.findAllContaining(new Range(5, 0, 6, 10))];
                expect(entries.length).toBe(1);
                expect(entries[0][1]).toBe(1);
            });
            it("when contained", () => {
                const map = new RangeMap();
                map.set(new Range(5, 0, 6, 10), 1);
                const entries = [...map.findAllContaining(new Range(5, 1, 6, 9))];
                expect(entries.length).toBe(1);
                expect(entries[0][1]).toBe(1);
            });
            it("when fully before", () => {
                const map = new RangeMap();
                map.set(new Range(5, 0, 6, 10), 1);
                const entries = [...map.findAllContaining(new Range(3, 0, 3, 1))];
                expect(entries.length).toBe(0);
            });
            it("when fully after", () => {
                const map = new RangeMap();
                map.set(new Range(5, 0, 6, 10), 1);
                const entries = [...map.findAllContaining(new Range(7, 0, 7, 1))];
                expect(entries.length).toBe(0);
            });
        });
        describe("findAllContainedBy", () => {
            it("when equal", () => {
                const map = new RangeMap();
                map.set(new Range(4, 0, 4, 9), 0);
                map.set(new Range(5, 0, 6, 10), 1);
                map.set(new Range(6, 15, 7, 0), 2);
                const entries = [...map.findAllContainedBy(new Range(5, 0, 6, 10))];
                expect(entries.length).toBe(1);
                expect(entries[0][1]).toBe(1);
            });
            it("when contained", () => {
                const map = new RangeMap();
                map.set(new Range(4, 0, 4, 9), 0);
                map.set(new Range(5, 0, 6, 10), 1);
                map.set(new Range(6, 15, 7, 0), 2);
                const entries = [...map.findAllContainedBy(new Range(4, 10, 6, 11))];
                expect(entries.length).toBe(1);
                expect(entries[0][1]).toBe(1);
            });
            it("when fully before", () => {
                const map = new RangeMap();
                map.set(new Range(5, 0, 6, 10), 1);
                const entries = [...map.findAllContainedBy(new Range(3, 0, 3, 1))];
                expect(entries.length).toBe(0);
            });
            it("when fully after", () => {
                const map = new RangeMap();
                map.set(new Range(5, 0, 6, 10), 1);
                const entries = [...map.findAllContainedBy(new Range(7, 0, 7, 1))];
                expect(entries.length).toBe(0);
            });
            it("when overlap start", () => {
                const map = new RangeMap();
                map.set(new Range(4, 0, 4, 9), 0);
                map.set(new Range(5, 0, 6, 10), 1);
                map.set(new Range(6, 15, 7, 0), 2);
                const entries = [...map.findAllContainedBy(new Range(4, 10, 5, 1))];
                expect(entries.length).toBe(0);
            });
            it("when overlap end", () => {
                const map = new RangeMap();
                map.set(new Range(4, 0, 4, 9), 0);
                map.set(new Range(5, 0, 6, 10), 1);
                map.set(new Range(6, 15, 7, 0), 2);
                const entries = [...map.findAllContainedBy(new Range(6, 9, 6, 11))];
                expect(entries.length).toBe(0);
            });
            it("in order", () => {
                const map = new RangeMap();
                map.set(new Range(4, 0, 4, 9), 0);
                map.set(new Range(5, 0, 6, 10), 1);
                map.set(new Range(6, 15, 7, 0), 2);
                map.set(new Range(7, 2, 7, 3), 3);
                const entries = [...map.findAllContainedBy(new Range(4, 10, 7, 1))];
                expect(entries.length).toBe(2);
                expect(entries[0][1]).toBe(1);
                expect(entries[1][1]).toBe(2);
            });
        });
        describe("findAllIntersecting", () => {
            it("when equal", () => {
                const map = new RangeMap();
                map.set(new Range(4, 0, 4, 9), 0);
                map.set(new Range(5, 0, 6, 10), 1);
                map.set(new Range(6, 15, 7, 0), 2);
                const entries = [...map.findAllIntersecting(new Range(5, 0, 6, 10))];
                expect(entries.length).toBe(1);
                expect(entries[0][1]).toBe(1);
            });
            it("when overlap start (exclusive)", () => {
                const map = new RangeMap();
                map.set(new Range(4, 0, 4, 9), 0);
                map.set(new Range(5, 0, 6, 10), 1);
                map.set(new Range(6, 15, 7, 0), 2);
                const entries = [...map.findAllIntersecting(new Range(4, 10, 5, 1))];
                expect(entries.length).toBe(1);
                expect(entries[0][1]).toBe(1);
            });
            it("when overlap start (inclusive)", () => {
                const map = new RangeMap();
                map.set(new Range(4, 0, 4, 9), 0);
                map.set(new Range(5, 0, 6, 10), 1);
                map.set(new Range(6, 15, 7, 0), 2);
                const entries = [...map.findAllIntersecting(new Range(4, 10, 5, 0))];
                expect(entries.length).toBe(1);
                expect(entries[0][1]).toBe(1);
            });
            it("when overlap end (exclusive)", () => {
                const map = new RangeMap();
                map.set(new Range(4, 0, 4, 9), 0);
                map.set(new Range(5, 0, 6, 10), 1);
                map.set(new Range(6, 15, 7, 0), 2);
                const entries = [...map.findAllIntersecting(new Range(6, 9, 6, 11))];
                expect(entries.length).toBe(1);
                expect(entries[0][1]).toBe(1);
            });
            it("when overlap end (inclusive)", () => {
                const map = new RangeMap();
                map.set(new Range(4, 0, 4, 9), 0);
                map.set(new Range(5, 0, 6, 10), 1);
                map.set(new Range(6, 15, 7, 0), 2);
                const entries = [...map.findAllIntersecting(new Range(6, 10, 6, 11))];
                expect(entries.length).toBe(1);
                expect(entries[0][1]).toBe(1);
            });
            it("when contained", () => {
                const map = new RangeMap();
                map.set(new Range(4, 0, 4, 9), 0);
                map.set(new Range(5, 0, 6, 10), 1);
                map.set(new Range(6, 15, 7, 0), 2);
                const entries = [...map.findAllIntersecting(new Range(5, 1, 6, 9))];
                expect(entries.length).toBe(1);
                expect(entries[0][1]).toBe(1);
            });
            it("when fully before", () => {
                const map = new RangeMap();
                map.set(new Range(5, 0, 6, 10), 1);
                const entries = [...map.findAllIntersecting(new Range(3, 0, 3, 1))];
                expect(entries.length).toBe(0);
            });
            it("when fully after", () => {
                const map = new RangeMap();
                map.set(new Range(5, 0, 6, 10), 1);
                const entries = [...map.findAllIntersecting(new Range(7, 0, 7, 1))];
                expect(entries.length).toBe(0);
            });
            it("in order", () => {
                const map = new RangeMap();
                map.set(new Range(4, 0, 4, 9), 0);
                map.set(new Range(5, 0, 6, 10), 1);
                map.set(new Range(6, 15, 7, 0), 2);
                map.set(new Range(7, 2, 7, 3), 3);
                const entries = [...map.findAllIntersecting(new Range(6, 9, 6, 16))];
                expect(entries.length).toBe(2);
                expect(entries[0][1]).toBe(1);
                expect(entries[1][1]).toBe(2);
            });
        });
    });
});
