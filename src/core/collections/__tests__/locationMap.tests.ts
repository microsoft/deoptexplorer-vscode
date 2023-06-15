import { Location, Position, Range, Uri } from "vscode";
import { LocationMap } from "../locationMap";

describe("LocationMap", () => {
    const loc1 = new Location(Uri.parse("file:///a"), new Range(new Position(0, 0), new Position(0, 3)));
    const loc1_sameFileAndRange = new Location(Uri.parse("file:///a"), new Range(new Position(0, 0), new Position(0, 3)));
    const loc1_sameFileAndStartDifferentEnd = new Location(Uri.parse("file:///a"), new Range(new Position(0, 0), new Position(0, 4)));
    const loc1_sameFileAndEndDifferentStart = new Location(Uri.parse("file:///a"), new Range(new Position(0, 1), new Position(0, 3)));
    const loc1_sameFileWithRangeCollapsedToStart = new Location(Uri.parse("file:///a"), new Position(0, 0));
    const loc1_sameFileWithRangeCollapsedToEnd = new Location(Uri.parse("file:///a"), new Position(0, 3));
    const loc1_sameFileAndLineWithOverlappingRange = new Location(Uri.parse("file:///a"), new Range(new Position(0, 2), new Position(0, 4)));
    const loc1_sameFileAndLineWithNonOverlappingRange = new Location(Uri.parse("file:///a"), new Range(new Position(0, 4), new Position(0, 6)));
    const loc1_sameFileDifferentLine = new Location(Uri.parse("file:///a"), new Range(new Position(1, 0), new Position(1, 3)));
    const loc1_differentFile = new Location(Uri.parse("file:///b"), new Range(new Position(0, 0), new Position(0, 3)));

    const loc2 = new Location(Uri.parse("file:///a"), new Position(0, 3));
    const loc2_sameFileAndRange = new Location(Uri.parse("file:///a"), new Position(0, 3));
    const loc2_sameFileAndStartDifferentEnd = new Location(Uri.parse("file:///a"), new Range(new Position(0, 3), new Position(0, 4)));
    const loc2_sameFileAndEndDifferentStart = new Location(Uri.parse("file:///a"), new Range(new Position(0, 0), new Position(0, 3)));
    const loc2_sameFileAndLineDifferentPosition = new Location(Uri.parse("file:///a"), new Position(0, 4));
    const loc2_sameFileDifferentLine = new Location(Uri.parse("file:///a"), new Position(1, 3));
    const loc2_differentFile = new Location(Uri.parse("file:///b"), new Position(0, 3));

    describe("has()", () => {
        describe("when range is non-empty", () => {
            it("returns false when map is empty", () => {
                const map = new LocationMap<string>();
                expect(map.has(loc1)).toBe(false);
            });
            it("returns true when location exists in map with same range", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                expect(map.has(loc1_sameFileAndRange)).toBe(true);
            });
            it("returns false when location does not exist in map", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                expect(map.has(loc1_sameFileAndStartDifferentEnd)).toBe(false);
                expect(map.has(loc1_sameFileAndEndDifferentStart)).toBe(false);
                expect(map.has(loc1_sameFileWithRangeCollapsedToStart)).toBe(false);
                expect(map.has(loc1_sameFileWithRangeCollapsedToEnd)).toBe(false);
                expect(map.has(loc1_sameFileAndLineWithOverlappingRange)).toBe(false);
                expect(map.has(loc1_sameFileAndLineWithNonOverlappingRange)).toBe(false);
                expect(map.has(loc1_sameFileDifferentLine)).toBe(false);
                expect(map.has(loc1_differentFile)).toBe(false);
            });
        });
        describe("when range is empty", () => {
            it("returns false when map is empty", () => {
                const map = new LocationMap<string>();
                expect(map.has(loc2)).toBe(false);
            });
            it("returns true when location exists in map with same range", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                expect(map.has(loc2_sameFileAndRange)).toBe(true);
            });
            it("returns false when location does not exist in map", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                expect(map.has(loc2_sameFileAndStartDifferentEnd)).toBe(false);
                expect(map.has(loc2_sameFileAndEndDifferentStart)).toBe(false);
                expect(map.has(loc2_sameFileAndLineDifferentPosition)).toBe(false);
                expect(map.has(loc2_sameFileDifferentLine)).toBe(false);
                expect(map.has(loc2_differentFile)).toBe(false);
            });
        });
    });
    describe("get()", () => {
        describe("when range is non-empty", () => {
            it("returns undefined when map is empty", () => {
                const map = new LocationMap<string>();
                expect(map.get(loc1)).toBeUndefined();
            });
            it("returns true when location exists in map with same range", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                expect(map.get(loc1_sameFileAndRange)).toBe("a");
            });
            it("returns undefined when location does not exist in map", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                expect(map.get(loc1_sameFileAndStartDifferentEnd)).toBeUndefined();
                expect(map.get(loc1_sameFileAndEndDifferentStart)).toBeUndefined();
                expect(map.get(loc1_sameFileWithRangeCollapsedToStart)).toBeUndefined();
                expect(map.get(loc1_sameFileWithRangeCollapsedToEnd)).toBeUndefined();
                expect(map.get(loc1_sameFileAndLineWithOverlappingRange)).toBeUndefined();
                expect(map.get(loc1_sameFileAndLineWithNonOverlappingRange)).toBeUndefined();
                expect(map.get(loc1_sameFileDifferentLine)).toBeUndefined();
                expect(map.get(loc1_differentFile)).toBeUndefined();
            });
            it("returns correct value for various locations", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                map.set(loc1_sameFileAndStartDifferentEnd, "b");
                map.set(loc1_sameFileAndEndDifferentStart, "c");
                map.set(loc1_sameFileWithRangeCollapsedToStart, "d");
                map.set(loc1_sameFileWithRangeCollapsedToEnd, "e");
                map.set(loc1_sameFileAndLineWithOverlappingRange, "f");
                map.set(loc1_sameFileAndLineWithNonOverlappingRange, "g");
                map.set(loc1_sameFileDifferentLine, "h");
                map.set(loc1_differentFile, "i");
                expect(map.get(loc1)).toBe("a");
                expect(map.get(loc1_sameFileAndStartDifferentEnd)).toBe("b");
                expect(map.get(loc1_sameFileAndEndDifferentStart)).toBe("c");
                expect(map.get(loc1_sameFileWithRangeCollapsedToStart)).toBe("d");
                expect(map.get(loc1_sameFileWithRangeCollapsedToEnd)).toBe("e");
                expect(map.get(loc1_sameFileAndLineWithOverlappingRange)).toBe("f");
                expect(map.get(loc1_sameFileAndLineWithNonOverlappingRange)).toBe("g");
                expect(map.get(loc1_sameFileDifferentLine)).toBe("h");
                expect(map.get(loc1_differentFile)).toBe("i");
            });
        });
        describe("when range is empty", () => {
            it("returns undefined when map is empty", () => {
                const map = new LocationMap<string>();
                expect(map.get(loc2)).toBeUndefined();
            });
            it("returns true when location exists in map with same range", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                expect(map.get(loc2_sameFileAndRange)).toBe("a");
            });
            it("returns undefined when location does not exist in map", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                expect(map.get(loc2_sameFileAndStartDifferentEnd)).toBeUndefined();
                expect(map.get(loc2_sameFileAndEndDifferentStart)).toBeUndefined();
                expect(map.get(loc2_sameFileAndLineDifferentPosition)).toBeUndefined();
                expect(map.get(loc2_sameFileDifferentLine)).toBeUndefined();
                expect(map.get(loc2_differentFile)).toBeUndefined();
            });
            it("returns correct value for various locations", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                map.set(loc2_sameFileAndStartDifferentEnd, "b");
                map.set(loc2_sameFileAndEndDifferentStart, "c");
                map.set(loc2_sameFileAndLineDifferentPosition, "d");
                map.set(loc2_sameFileDifferentLine, "e");
                map.set(loc2_differentFile, "f");
                expect(map.get(loc2)).toBe("a");
                expect(map.get(loc2_sameFileAndStartDifferentEnd)).toBe("b");
                expect(map.get(loc2_sameFileAndEndDifferentStart)).toBe("c");
                expect(map.get(loc2_sameFileAndLineDifferentPosition)).toBe("d");
                expect(map.get(loc2_sameFileDifferentLine)).toBe("e");
                expect(map.get(loc2_differentFile)).toBe("f");
            });
        });
    });
    describe("set()", () => {
        describe("when range is non-empty", () => {
            it("increments size for new key", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                expect(map.size).toBe(1);
            });
            it("does not increment size for equivalent key", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                map.set(loc1_sameFileAndRange, "b");
                expect(map.size).toBe(1);
            });
            it("overwrites value when location exists in map with same range", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                map.set(loc1_sameFileAndRange, "b");
                expect(map.get(loc1)).toBe("b");
            });
            it("increments size for various locations", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                map.set(loc1_sameFileAndStartDifferentEnd, "b");
                map.set(loc1_sameFileAndEndDifferentStart, "c");
                map.set(loc1_sameFileWithRangeCollapsedToStart, "d");
                map.set(loc1_sameFileWithRangeCollapsedToEnd, "e");
                map.set(loc1_sameFileAndLineWithOverlappingRange, "f");
                map.set(loc1_sameFileAndLineWithNonOverlappingRange, "g");
                map.set(loc1_sameFileDifferentLine, "h");
                map.set(loc1_differentFile, "i");
                expect(map.size).toBe(9);
            });
            it("sets correct value for various locations", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                map.set(loc1_sameFileAndStartDifferentEnd, "b");
                map.set(loc1_sameFileAndEndDifferentStart, "c");
                map.set(loc1_sameFileWithRangeCollapsedToStart, "d");
                map.set(loc1_sameFileWithRangeCollapsedToEnd, "e");
                map.set(loc1_sameFileAndLineWithOverlappingRange, "f");
                map.set(loc1_sameFileAndLineWithNonOverlappingRange, "g");
                map.set(loc1_sameFileDifferentLine, "h");
                map.set(loc1_differentFile, "i");
                expect(map.get(loc1)).toBe("a");
                expect(map.get(loc1_sameFileAndStartDifferentEnd)).toBe("b");
                expect(map.get(loc1_sameFileAndEndDifferentStart)).toBe("c");
                expect(map.get(loc1_sameFileWithRangeCollapsedToStart)).toBe("d");
                expect(map.get(loc1_sameFileWithRangeCollapsedToEnd)).toBe("e");
                expect(map.get(loc1_sameFileAndLineWithOverlappingRange)).toBe("f");
                expect(map.get(loc1_sameFileAndLineWithNonOverlappingRange)).toBe("g");
                expect(map.get(loc1_sameFileDifferentLine)).toBe("h");
                expect(map.get(loc1_differentFile)).toBe("i");
            });
        });
        describe("when range is empty", () => {
            it("increments size for new key", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                expect(map.size).toBe(1);
            });
            it("does not increment size for equivalent key", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                map.set(loc2_sameFileAndRange, "b");
                expect(map.size).toBe(1);
            });
            it("overwrites value when location exists in map with same range", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                map.set(loc2_sameFileAndRange, "b");
                expect(map.get(loc2)).toBe("b");
            });
            it("increments size for various locations", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                map.set(loc2_sameFileAndStartDifferentEnd, "b");
                map.set(loc2_sameFileAndEndDifferentStart, "c");
                map.set(loc2_sameFileAndLineDifferentPosition, "d");
                map.set(loc2_sameFileDifferentLine, "e");
                map.set(loc2_differentFile, "f");
                expect(map.size).toBe(6);
            });
            it("sets correct value for various locations", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                map.set(loc2_sameFileAndStartDifferentEnd, "b");
                map.set(loc2_sameFileAndEndDifferentStart, "c");
                map.set(loc2_sameFileAndLineDifferentPosition, "d");
                map.set(loc2_sameFileDifferentLine, "e");
                map.set(loc2_differentFile, "f");
                expect(map.get(loc2)).toBe("a");
                expect(map.get(loc2_sameFileAndStartDifferentEnd)).toBe("b");
                expect(map.get(loc2_sameFileAndEndDifferentStart)).toBe("c");
                expect(map.get(loc2_sameFileAndLineDifferentPosition)).toBe("d");
                expect(map.get(loc2_sameFileDifferentLine)).toBe("e");
                expect(map.get(loc2_differentFile)).toBe("f");
            });
        });
    });
    describe("delete()", () => {
        describe("when range is non-empty", () => {
            it("does not decrement size for nonexistant key", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                map.delete(loc1_differentFile);
                expect(map.size).toBe(1);
            });
            it("decrements size for existing key", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                map.delete(loc1);
                expect(map.size).toBe(0);
            });
            it("decrements size for equivalent key", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                map.delete(loc1_sameFileAndRange);
                expect(map.size).toBe(0);
            });
            it("returns true when deleting existing location", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                expect(map.delete(loc1)).toBe(true);
            });
            it("returns false when deleting nonexistant location", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                expect(map.delete(loc1_differentFile)).toBe(false);
            });
            it("deletes value for existing location", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                map.delete(loc1);
                expect(map.get(loc1)).toBeUndefined();
            });
            it("deletes value when location exists in map with same range", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                map.delete(loc1_sameFileAndRange);
                expect(map.get(loc1)).toBeUndefined();
            });
            it("decrements size for various locations", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                map.set(loc1_sameFileAndStartDifferentEnd, "b");
                map.set(loc1_sameFileAndEndDifferentStart, "c");
                map.set(loc1_sameFileWithRangeCollapsedToStart, "d");
                map.set(loc1_sameFileWithRangeCollapsedToEnd, "e");
                map.set(loc1_sameFileAndLineWithOverlappingRange, "f");
                map.set(loc1_sameFileAndLineWithNonOverlappingRange, "g");
                map.set(loc1_sameFileDifferentLine, "h");
                map.set(loc1_differentFile, "i");
                map.delete(loc1);
                map.delete(loc1_sameFileAndStartDifferentEnd);
                map.delete(loc1_sameFileAndEndDifferentStart);
                map.delete(loc1_sameFileWithRangeCollapsedToStart);
                map.delete(loc1_sameFileWithRangeCollapsedToEnd);
                map.delete(loc1_sameFileAndLineWithOverlappingRange);
                map.delete(loc1_sameFileAndLineWithNonOverlappingRange);
                map.delete(loc1_sameFileDifferentLine);
                map.delete(loc1_differentFile);
                expect(map.size).toBe(0);
            });
            it("deletes value for various locations", () => {
                const map = new LocationMap<string>();
                map.set(loc1, "a");
                map.set(loc1_sameFileAndStartDifferentEnd, "b");
                map.set(loc1_sameFileAndEndDifferentStart, "c");
                map.set(loc1_sameFileWithRangeCollapsedToStart, "d");
                map.set(loc1_sameFileWithRangeCollapsedToEnd, "e");
                map.set(loc1_sameFileAndLineWithOverlappingRange, "f");
                map.set(loc1_sameFileAndLineWithNonOverlappingRange, "g");
                map.set(loc1_sameFileDifferentLine, "h");
                map.set(loc1_differentFile, "i");
                map.delete(loc1);
                map.delete(loc1_sameFileAndStartDifferentEnd);
                map.delete(loc1_sameFileAndEndDifferentStart);
                map.delete(loc1_sameFileWithRangeCollapsedToStart);
                map.delete(loc1_sameFileWithRangeCollapsedToEnd);
                map.delete(loc1_sameFileAndLineWithOverlappingRange);
                map.delete(loc1_sameFileAndLineWithNonOverlappingRange);
                map.delete(loc1_sameFileDifferentLine);
                map.delete(loc1_differentFile);
                expect(map.get(loc1)).toBeUndefined();
                expect(map.get(loc1_sameFileAndStartDifferentEnd)).toBeUndefined();
                expect(map.get(loc1_sameFileAndEndDifferentStart)).toBeUndefined();
                expect(map.get(loc1_sameFileWithRangeCollapsedToStart)).toBeUndefined();
                expect(map.get(loc1_sameFileWithRangeCollapsedToEnd)).toBeUndefined();
                expect(map.get(loc1_sameFileAndLineWithOverlappingRange)).toBeUndefined();
                expect(map.get(loc1_sameFileAndLineWithNonOverlappingRange)).toBeUndefined();
                expect(map.get(loc1_sameFileDifferentLine)).toBeUndefined();
                expect(map.get(loc1_differentFile)).toBeUndefined();
            });
        });
        describe("when range is empty", () => {
            it("does not decrement size for nonexistant key", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                map.delete(loc2_differentFile);
                expect(map.size).toBe(1);
            });
            it("decrements size for existing key", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                map.delete(loc2);
                expect(map.size).toBe(0);
            });
            it("decrements size for equivalent key", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                map.delete(loc2_sameFileAndRange);
                expect(map.size).toBe(0);
            });
            it("returns true when deleting existing location", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                expect(map.delete(loc2)).toBe(true);
            });
            it("returns false when deleting nonexistant location", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                expect(map.delete(loc2_differentFile)).toBe(false);
            });
            it("deletes value for existing location", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                map.delete(loc2);
                expect(map.get(loc2)).toBeUndefined();
            });
            it("deletes value when location exists in map with same range", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                map.delete(loc2_sameFileAndRange);
                expect(map.get(loc2)).toBeUndefined();
            });
            it("decrements size for various locations", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                map.set(loc2_sameFileAndStartDifferentEnd, "b");
                map.set(loc2_sameFileAndEndDifferentStart, "c");
                map.set(loc2_sameFileAndLineDifferentPosition, "d");
                map.set(loc2_sameFileDifferentLine, "e");
                map.set(loc2_differentFile, "f");
                map.delete(loc2);
                map.delete(loc2_sameFileAndStartDifferentEnd);
                map.delete(loc2_sameFileAndEndDifferentStart);
                map.delete(loc2_sameFileAndLineDifferentPosition);
                map.delete(loc2_sameFileDifferentLine);
                map.delete(loc2_differentFile);
                expect(map.size).toBe(0);
            });
            it("deletes value for various locations", () => {
                const map = new LocationMap<string>();
                map.set(loc2, "a");
                map.set(loc2_sameFileAndStartDifferentEnd, "b");
                map.set(loc2_sameFileAndEndDifferentStart, "c");
                map.set(loc2_sameFileAndLineDifferentPosition, "d");
                map.set(loc2_sameFileDifferentLine, "e");
                map.set(loc2_differentFile, "f");
                map.delete(loc2);
                map.delete(loc2_sameFileAndStartDifferentEnd);
                map.delete(loc2_sameFileAndEndDifferentStart);
                map.delete(loc2_sameFileAndLineDifferentPosition);
                map.delete(loc2_sameFileDifferentLine);
                map.delete(loc2_differentFile);
                expect(map.get(loc2)).toBeUndefined();
                expect(map.get(loc2_sameFileAndStartDifferentEnd)).toBeUndefined();
                expect(map.get(loc2_sameFileAndEndDifferentStart)).toBeUndefined();
                expect(map.get(loc2_sameFileAndLineDifferentPosition)).toBeUndefined();
                expect(map.get(loc2_sameFileDifferentLine)).toBeUndefined();
                expect(map.get(loc2_differentFile)).toBeUndefined();
            });
        });
    });
    describe("clear()", () => {
        it("resets size when entries exist", () => {
            const map = new LocationMap();
            map.set(loc1, "a");
            map.set(loc1_differentFile, "b");
            map.clear();
            expect(map.size).toBe(0);
        });
        it("deletes values when entries exist", () => {
            const map = new LocationMap();
            map.set(loc1, "a");
            map.set(loc1_differentFile, "b");
            map.clear();
            expect(map.get(loc1)).toBeUndefined();
            expect(map.get(loc1_differentFile)).toBeUndefined();
        });
    });
});