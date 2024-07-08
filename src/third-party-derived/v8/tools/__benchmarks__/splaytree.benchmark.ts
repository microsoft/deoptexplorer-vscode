import { benchmark } from "#benchmarks";
import { generate } from "@esfx/iter-fn";
import { SplayTree } from "../splaytree";
import { SplayTree as SplayTreeNoComparator } from "./splaytree/splaytreeNoComparer";
import { SplayTree as SplayTreeWithComparator } from "./splaytree/splaytreeWithComparer";

const MAX_INT32 = (2 ** 31) - 1;
describe("splaytree", () => {
    const count = 1000;
    const implementations = [
        { name: "SplayTree (current)", SplayTree },
        { name: "SplayTree (no comparer)", SplayTree: SplayTreeNoComparator },
        { name: "SplayTree (with default comparer)", SplayTree: SplayTreeWithComparator },
        { name: "SplayTree (with custom comparer)", SplayTree: class extends SplayTreeWithComparator<number, number> { constructor() { super((a, b) => a - b) } } },
    ];

    describe(`set() ${count} elements`, () => {
        let entries: [number, number][];
        beforeAll(() => {
            entries = [...generate(count, i => [Math.floor(Math.random() * MAX_INT32), i] as [number, number])];
        });
        afterAll(() => {
            entries = undefined!;
        });

        benchmark.each(implementations)("$name", ({ SplayTree }) => {
            const tree = new SplayTree<number, number>();
            for (const [key, value] of entries) {
                tree.insert(key, value);
            }
        });
    });
});