import { ImmutableEnumSet } from "../enumSet";
describe("ImmutableEnumSet", () => {
    describe("constructor()", () => {
        describe("no arguments", () => {
            it("is empty", () => {
                const set = new ImmutableEnumSet();
                expect(set.size).toBe(0);
            });
        });
        describe("with multiple unique values", () => {
            const values = ["a", "b", "c"];
            it(".size is correct", () => {
                const set = new ImmutableEnumSet(values);
                expect(set.size).toBe(3);
            });
            it("contains all values", () => {
                const set = new ImmutableEnumSet(values);
                expect(set.has("a")).toBe(true);
                expect(set.has("b")).toBe(true);
                expect(set.has("c")).toBe(true);
            });
        });
        describe("with multiple non-unique values", () => {
            const values = ["a", "b", "c", "b"];
            it(".size is correct", () => {
                const set = new ImmutableEnumSet(values);
                expect(set.size).toBe(3);
            });
            it("contains all values", () => {
                const set = new ImmutableEnumSet(values);
                expect(set.has("a")).toBe(true);
                expect(set.has("b")).toBe(true);
                expect(set.has("c")).toBe(true);
            });
        });
        describe("with existing set as values", () => {
            it("returns the argument", () => {
                const set1 = new ImmutableEnumSet(["a"]);
                const set2 = new ImmutableEnumSet(set1);
                expect(set2).toBe(set1);
            });
        });
    });
    describe("static empty()", () => {
        it(".size is correct", () => {
            const set = ImmutableEnumSet.empty();
            expect(set.size).toBe(0);
        });
        it("produces new set each time", () => {
            const set1 = ImmutableEnumSet.empty();
            const set2 = ImmutableEnumSet.empty();
            expect(set2).not.toBe(set1);
        });
    });
    describe("static for()", () => {
        describe("with multiple unique values", () => {
            const values = ["a", "b", "c"];
            it(".size is correct", () => {
                const set = ImmutableEnumSet.for(values);
                expect(set.size).toBe(3);
            });
            it("contains all values", () => {
                const set = ImmutableEnumSet.for(values);
                expect(set.has("a")).toBe(true);
                expect(set.has("b")).toBe(true);
                expect(set.has("c")).toBe(true);
            });
        });
        describe("with multiple non-unique values", () => {
            const values = ["a", "b", "c", "b"];
            it(".size is correct", () => {
                const set = ImmutableEnumSet.for(values);
                expect(set.size).toBe(3);
            });
            it("contains all values", () => {
                const set = ImmutableEnumSet.for(values);
                expect(set.has("a")).toBe(true);
                expect(set.has("b")).toBe(true);
                expect(set.has("c")).toBe(true);
            });
        });
        describe("with existing set as values", () => {
            it("returns the argument", () => {
                const set1 = new ImmutableEnumSet(["a"]);
                const set2 = ImmutableEnumSet.for(set1);
                expect(set2).toBe(set1);
            });
        });
    });
    describe("has()", () => {
        it("returns true when value exists in set", () => {
            const set = new ImmutableEnumSet(["a"]);
            expect(set.has("a")).toBe(true);
        });
        it("returns false when value does not exist in set", () => {
            const set = new ImmutableEnumSet<string>(["a"]);
            expect(set.has("b")).toBe(false);
        });
    });
    describe("add()", () => {
        it("returns new set when value does not exist in set", () => {
            const set1 = new ImmutableEnumSet();
            const set2 = set1.add("a");
            expect(set2).not.toBe(set1);
        });
        it("result contains value when value does not exist in set", () => {
            const set1 = new ImmutableEnumSet();
            const set2 = set1.add("a");
            expect(set2.has("a")).toBe(true);
        });
        it("result size incremented when value does not exist in set", () => {
            const set1 = new ImmutableEnumSet();
            const set2 = set1.add("a");
            expect(set2.size).toBe(1);
        });
        it("does not mutate existing set when value does not exist in set", () => {
            const set1 = new ImmutableEnumSet();
            set1.add("a");
            expect(set1.size).toBe(0);
            expect(set1.has("a")).toBe(false);
        });
        it("returns same set when value exists in set", () => {
            const set1 = new ImmutableEnumSet(["a"]);
            const set2 = set1.add("a");
            expect(set2).toBe(set1);
        });
    });
    describe("delete()", () => {
        it("returns new set when value exists in set", () => {
            const set1 = new ImmutableEnumSet(["a"]);
            const set2 = set1.delete("a");
            expect(set2).not.toBe(set1);
        });
        it("result does not contain value when value exists in set", () => {
            const set1 = new ImmutableEnumSet(["a"]);
            const set2 = set1.delete("a");
            expect(set2.has("a")).toBe(false);
        });
        it("result size decremented when value exists in set", () => {
            const set1 = new ImmutableEnumSet(["a"]);
            const set2 = set1.delete("a");
            expect(set2.size).toBe(0);
        });
        it("does not mutate existing set when value exists in set", () => {
            const set1 = new ImmutableEnumSet(["a"]);
            set1.delete("a");
            expect(set1.size).toBe(1);
            expect(set1.has("a")).toBe(true);
        });
        it("returns same set when value does not exist in set", () => {
            const set1 = new ImmutableEnumSet<string>(["b"]);
            const set2 = set1.delete("a");
            expect(set2).toBe(set1);
        });
    });
    describe("clear()", () => {
        it("returns new set when set is not empty", () => {
            const set1 = new ImmutableEnumSet(["a"]);
            const set2 = set1.clear();
            expect(set2).not.toBe(set1);
        });
        it("result does not contain values when set is not empty", () => {
            const set1 = new ImmutableEnumSet(["a"]);
            const set2 = set1.clear();
            expect(set2.has("a")).toBe(false);
        });
        it("result is empty when set is not empty", () => {
            const set1 = new ImmutableEnumSet(["a"]);
            const set2 = set1.clear();
            expect(set2.size).toBe(0);
        });
        it("does not mutate existing set when set is not empty", () => {
            const set1 = new ImmutableEnumSet(["a"]);
            set1.clear();
            expect(set1.size).toBe(1);
            expect(set1.has("a")).toBe(true);
        });
        it("returns same set when set is empty", () => {
            const set1 = new ImmutableEnumSet<string>();
            const set2 = set1.clear();
            expect(set2).toBe(set1);
        });
    });
    describe("union()", () => {
        it("returns this set when other set is empty", () => {
            const set1 = new ImmutableEnumSet<string>(["a"]);
            const set2 = new ImmutableEnumSet<string>();
            const set3 = set1.union(set2);
            expect(set3).toBe(set1);
        });
        it("returns this set both sets are empty", () => {
            const set1 = new ImmutableEnumSet<string>();
            const set2 = new ImmutableEnumSet<string>();
            const set3 = set1.union(set2);
            expect(set3).toBe(set1);
        });
        it("returns other set when this set is empty", () => {
            const set1 = new ImmutableEnumSet<string>([]);
            const set2 = new ImmutableEnumSet<string>(["a"]);
            const set3 = set1.union(set2);
            expect(set3).toBe(set2);
        });
        it("returns this set when other set is a subset of this set", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b", "c"]);
            const set2 = new ImmutableEnumSet<string>(["a", "b"]);
            const set3 = set1.union(set2);
            expect(set3).toBe(set1);
        });
        it("returns other set when this set is a subset of other set", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["a", "b", "c"]);
            const set3 = set1.union(set2);
            expect(set3).toBe(set2);
        });
        it("returns new set when neither set is a subset of the other", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["b", "c"]);
            const set3 = set1.union(set2);
            expect(set3).not.toBe(set1);
            expect(set3).not.toBe(set2);
        });
        it("result has correct size when neither set is a subset of the other", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["b", "c"]);
            const set3 = set1.union(set2);
            expect(set3.size).toBe(3);
        });
        it("result has all elements from both sets when neither set is a subset of the other", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["b", "c"]);
            const set3 = set1.union(set2);
            expect(set3.has("a")).toBe(true);
            expect(set3.has("b")).toBe(true);
            expect(set3.has("c")).toBe(true);
        });
        it("does not mutate this set when neither set is a subset of the other", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["b", "c"]);
            set1.union(set2);
            expect(set1.size).toBe(2);
            expect(set1.has("a")).toBe(true);
            expect(set1.has("b")).toBe(true);
            expect(set1.has("c")).toBe(false);
        });
        it("does not mutate other set when neither set is a subset of the other", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["b", "c"]);
            set1.union(set2);
            expect(set2.size).toBe(2);
            expect(set2.has("a")).toBe(false);
            expect(set2.has("b")).toBe(true);
            expect(set2.has("c")).toBe(true);
        });
    });
    describe("intersect()", () => {
        it("returns this set when this set is empty", () => {
            const set1 = new ImmutableEnumSet<string>();
            const set2 = new ImmutableEnumSet<string>(["a"]);
            const set3 = set1.intersect(set2);
            expect(set3).toBe(set1);
        });
        it("returns this set when both sets are empty", () => {
            const set1 = new ImmutableEnumSet<string>();
            const set2 = new ImmutableEnumSet<string>();
            const set3 = set1.intersect(set2);
            expect(set3).toBe(set1);
        });
        it("returns other set when other set is empty", () => {
            const set1 = new ImmutableEnumSet<string>(["a"]);
            const set2 = new ImmutableEnumSet<string>();
            const set3 = set1.intersect(set2);
            expect(set3).toBe(set2);
        });
        it("returns this set when other set is a superset of this set", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["a", "b", "c"]);
            const set3 = set1.intersect(set2);
            expect(set3).toBe(set1);
        });
        it("returns other set when this set is a superset of other set", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b", "c"]);
            const set2 = new ImmutableEnumSet<string>(["a", "b"]);
            const set3 = set1.intersect(set2);
            expect(set3).toBe(set2);
        });
        it("returns new set when neither set is a superset of the other but both overlap", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["b", "c"]);
            const set3 = set1.intersect(set2);
            expect(set3).not.toBe(set1);
            expect(set3).not.toBe(set2);
        });
        it("result has correct size when neither set is a superset of the other but both overlap", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["b", "c"]);
            const set3 = set1.intersect(set2);
            expect(set3.size).toBe(1);
        });
        it("result has elements only in both sets when neither set is a superset of the other but both overlap", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["b", "c"]);
            const set3 = set1.intersect(set2);
            expect(set3.has("a")).toBe(false);
            expect(set3.has("b")).toBe(true);
            expect(set3.has("c")).toBe(false);
        });
        it("result is empty when neither set overlaps with the other", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["c", "d"]);
            const set3 = set1.intersect(set2);
            expect(set3.size).toBe(0);
        });
        it("does not mutate this set when neither set is a superset of the other", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["b", "c"]);
            set1.intersect(set2);
            expect(set1.size).toBe(2);
            expect(set1.has("a")).toBe(true);
            expect(set1.has("b")).toBe(true);
            expect(set1.has("c")).toBe(false);
        });
        it("does not mutate other set when neither set is a superset of the other", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["b", "c"]);
            set1.intersect(set2);
            expect(set2.size).toBe(2);
            expect(set2.has("a")).toBe(false);
            expect(set2.has("b")).toBe(true);
            expect(set2.has("c")).toBe(true);
        });
    });
    describe("static equals()", () => {
        it("returns true when both sets are same reference", () => {
            const set1 = new ImmutableEnumSet<string>();
            const set2 = set1;
            expect(ImmutableEnumSet.equals(set1, set2)).toBe(true);
        });
        it("returns true when both sets are empty", () => {
            const set1 = new ImmutableEnumSet<string>();
            const set2 = new ImmutableEnumSet<string>();
            expect(ImmutableEnumSet.equals(set1, set2)).toBe(true);
        });
        it("returns false when sets have different sizes", () => {
            const set1 = new ImmutableEnumSet<string>(["a"]);
            const set2 = new ImmutableEnumSet<string>(["b", "c"]);
            expect(ImmutableEnumSet.equals(set1, set2)).toBe(false);
        });
        it("returns false when sets have same size but different values", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["c", "d"]);
            expect(ImmutableEnumSet.equals(set1, set2)).toBe(false);
        });
        it("returns true when sets have same size and same values", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["a", "b"]);
            expect(ImmutableEnumSet.equals(set1, set2)).toBe(true);
        });
        it("set value order does not matter", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["b", "a"]);
            expect(ImmutableEnumSet.equals(set1, set2)).toBe(true);
        });
    });
    describe("equals()", () => {
        it("returns true when both sets are same reference", () => {
            const set1 = new ImmutableEnumSet<string>();
            const set2 = set1;
            expect(set1.equals(set2)).toBe(true);
        });
        it("returns true when both sets are empty", () => {
            const set1 = new ImmutableEnumSet<string>();
            const set2 = new ImmutableEnumSet<string>();
            expect(set1.equals(set2)).toBe(true);
        });
        it("returns false when sets have different sizes", () => {
            const set1 = new ImmutableEnumSet<string>(["a"]);
            const set2 = new ImmutableEnumSet<string>(["b", "c"]);
            expect(set1.equals(set2)).toBe(false);
        });
        it("returns false when sets have same size but different values", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["c", "d"]);
            expect(set1.equals(set2)).toBe(false);
        });
        it("returns true when sets have same size and same values", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["a", "b"]);
            expect(set1.equals(set2)).toBe(true);
        });
        it("set value order does not matter", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["b", "a"]);
            expect(set1.equals(set2)).toBe(true);
        });
    });
    describe("hash", () => {
        it("hash does not change", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            expect(set1.hash()).toBe(set1.hash());
        });
        it("computes same hash for same values", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["a", "b"]);
            expect(set2.hash()).toBe(set1.hash());
        });
        it("computes different hash for different values (excl. collisions)", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["b", "c"]);
            expect(set2.hash()).not.toBe(set1.hash());
        });
        it("order does not matter", () => {
            const set1 = new ImmutableEnumSet<string>(["a", "b"]);
            const set2 = new ImmutableEnumSet<string>(["b", "a"]);
            expect(set2.hash()).toBe(set1.hash());
        });
    });
});