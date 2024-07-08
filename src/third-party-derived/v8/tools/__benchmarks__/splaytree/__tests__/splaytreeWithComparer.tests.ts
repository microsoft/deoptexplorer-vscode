import { SplayTree } from "../splaytreeWithComparer";

describe("splaytreeWithComparer", () => {
    describe("SplayTree", () => {
        describe("keys()", () => {
            it("in sort order", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(3, 3);
                tree.insert(1, 1);
                tree.insert(5, 5);
                tree.insert(4, 4);
                tree.insert(2, 2);
                const keys = [...tree.keys()];
                expect(keys).toEqual([1, 2, 3, 4, 5]);
            });
            it("in sort order after deletion", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(3, 3);
                tree.insert(1, 1);
                tree.insert(5, 5);
                tree.insert(4, 4);
                tree.insert(2, 2);
                tree.remove(2);
                const keys = [...tree.keys()];
                expect(keys).toEqual([1, 3, 4, 5]);
            });
            it("in sort order after deletion during iteration", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(3, 3);
                tree.insert(1, 1);
                tree.insert(5, 5);
                tree.insert(4, 4);
                tree.insert(2, 2);
                function * g() {
                    for (const key of tree.keys()) {
                        if (key === 2) {
                            tree.remove(3);
                        }
                        yield key;
                    }
                }
                const keys = [...g()];
                expect(keys).toEqual([1, 2, 4, 5]);
            });
            it("reversed", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(3, 3);
                tree.insert(1, 1);
                tree.insert(5, 5);
                tree.insert(4, 4);
                tree.insert(2, 2);
                const keys = [...tree.keys(/*startNode*/ undefined, /*reverse*/ true)];
                expect(keys).toEqual([5, 4, 3, 2, 1]);
            });
            it("reversed after deletion", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(3, 3);
                tree.insert(1, 1);
                tree.insert(5, 5);
                tree.insert(4, 4);
                tree.insert(2, 2);
                tree.remove(2);
                const keys = [...tree.keys(/*startNode*/ undefined, /*reverse*/ true)];
                expect(keys).toEqual([5, 4, 3, 1]);
            });
            it("reversed after deletion during iteration", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(3, 3);
                tree.insert(1, 1);
                tree.insert(5, 5);
                tree.insert(4, 4);
                tree.insert(2, 2);
                function * g() {
                    for (const key of tree.keys(/*startNode*/ undefined, /*reverse*/ true)) {
                        if (key === 4) {
                            tree.remove(3);
                        }
                        yield key;
                    }
                }
                const keys = [...g()];
                expect(keys).toEqual([5, 4, 2, 1]);
            });
            it("starting from node", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(3, 3);
                tree.insert(1, 1);
                tree.insert(5, 5);
                tree.insert(4, 4);
                tree.insert(2, 2);
                const startNode = tree.findLeastGreaterThan(2);
                const keys = [...tree.keys(startNode)];
                expect(keys).toEqual([2, 3, 4, 5]);
            });
            it("starting from node after deletion", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(3, 3);
                tree.insert(1, 1);
                tree.insert(5, 5);
                tree.insert(4, 4);
                tree.insert(2, 2);
                tree.remove(3);
                const startNode = tree.findLeastGreaterThan(2);
                const keys = [...tree.keys(startNode)];
                expect(keys).toEqual([2, 4, 5]);
            });
            it("starting from node after deletion during iteration", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(3, 3);
                tree.insert(1, 1);
                tree.insert(5, 5);
                tree.insert(4, 4);
                tree.insert(2, 2);
                function * g() {
                    const startNode = tree.findLeastGreaterThan(2);
                    for (const key of tree.keys(startNode)) {
                        if (key === 2) {
                            tree.remove(3);
                        }
                        yield key;
                    }
                }
                const keys = [...g()];
                expect(keys).toEqual([2, 4, 5]);
            });
            it("reversed starting from node", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(3, 3);
                tree.insert(1, 1);
                tree.insert(5, 5);
                tree.insert(4, 4);
                tree.insert(2, 2);
                const startNode = tree.findGreatestLessThan(4);
                const keys = [...tree.keys(startNode, /*reversed*/ true)];
                expect(keys).toEqual([4, 3, 2, 1]);
            });
            it("reversed starting from node after deletion", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(3, 3);
                tree.insert(1, 1);
                tree.insert(5, 5);
                tree.insert(4, 4);
                tree.insert(2, 2);
                tree.remove(3);
                const startNode = tree.findGreatestLessThan(4);
                const keys = [...tree.keys(startNode, /*reversed*/ true)];
                expect(keys).toEqual([4, 2, 1]);
            });
            it("reversed starting from node after deletion during iteration", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(3, 3);
                tree.insert(1, 1);
                tree.insert(5, 5);
                tree.insert(4, 4);
                tree.insert(2, 2);
                function * g() {
                    const startNode = tree.findGreatestLessThan(4);
                    for (const key of tree.keys(startNode, /*reversed*/ true)) {
                        if (key === 4) {
                            tree.remove(3);
                        }
                        yield key;
                    }
                }
                const keys = [...g()];
                expect(keys).toEqual([4, 2, 1]);
            });
        });
    });
    describe("SplayTree.Node", () => {
        describe("next", () => {
            it("when one node", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(1, 1);
                const node = tree.find(1);
                expect(node).toBeDefined();
                expect(node!.next).toBe(null);
            });
            it("first of two nodes", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(1, 1);
                tree.insert(2, 2);
                const node = tree.find(1);
                expect(node).toBeDefined();
                expect(node!.next).not.toBe(null);
                expect(node!.next!.key).toBe(2);
                expect(node!.next!.next).toBe(null);
            });
            it("second of two nodes", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(1, 1);
                tree.insert(2, 2);
                const node = tree.find(2);
                expect(node).toBeDefined();
                expect(node!.next).toBe(null);
            });
            it("second of three nodes", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(1, 1);
                tree.insert(2, 2);
                tree.insert(3, 3);
                const node = tree.find(2);
                expect(node).toBeDefined();
                expect(node!.next).not.toBe(null);
                expect(node!.next!.key).toBe(3);
                expect(node!.next!.next).toBe(null);
            });
            it("second of two nodes after deleting a node", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(1, 1);
                tree.insert(2, 2);
                tree.insert(3, 3);
                const node = tree.find(3);
                tree.remove(2);
                expect(node).toBeDefined();
                expect(node!.next).toBe(null);
            });
            it("first of two nodes after deleting a node", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(1, 1);
                tree.insert(2, 2);
                tree.insert(3, 3);
                const node = tree.find(1);
                tree.remove(2);
                expect(node).toBeDefined();
                expect(node!.next).not.toBe(null);
                expect(node!.next!.key).toBe(3);
                expect(node!.next!.next).toBe(null);
            });
            it("after deleting the node", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(1, 1);
                tree.insert(2, 2);
                tree.insert(3, 3);
                const node = tree.find(2);
                tree.remove(2);
                expect(node).toBeDefined();
                expect(node!.next).not.toBe(null);
                expect(node!.next!.key).toBe(3);
                expect(node!.next!.next).toBe(null);
            });
        });
        describe("prev", () => {
            it("when one node", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(1, 1);
                const node = tree.find(1);
                expect(node).toBeDefined();
                expect(node!.prev).toBe(null);
            });
            it("second of two nodes", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(1, 1);
                tree.insert(2, 2);
                const node = tree.find(2);
                expect(node).toBeDefined();
                expect(node!.prev).not.toBe(null);
                expect(node!.prev!.key).toBe(1);
                expect(node!.prev!.prev).toBe(null);
            });
            it("first of two nodes", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(1, 1);
                tree.insert(2, 2);
                const node = tree.find(1);
                expect(node).toBeDefined();
                expect(node!.prev).toBe(null);
            });
            it("second of three nodes", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(1, 1);
                tree.insert(2, 2);
                tree.insert(3, 3);
                const node = tree.find(2);
                expect(node).toBeDefined();
                expect(node!.prev).not.toBe(null);
                expect(node!.prev!.key).toBe(1);
                expect(node!.prev!.prev).toBe(null);
            });
            it("first of two nodes after deleting a node", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(1, 1);
                tree.insert(2, 2);
                tree.insert(3, 3);
                const node = tree.find(1);
                tree.remove(2);
                expect(node).toBeDefined();
                expect(node!.prev).toBe(null);
            });
            it("second of two nodes after deleting a node", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(1, 1);
                tree.insert(2, 2);
                tree.insert(3, 3);
                const node = tree.find(3);
                tree.remove(2);
                expect(node).toBeDefined();
                expect(node!.prev).not.toBe(null);
                expect(node!.prev!.key).toBe(1);
                expect(node!.prev!.prev).toBe(null);
            });
            it("after deleting the node", () => {
                const tree = new SplayTree<number, number>();
                tree.insert(1, 1);
                tree.insert(2, 2);
                tree.insert(3, 3);
                const node = tree.find(2);
                tree.remove(2);
                expect(node).toBeDefined();
                expect(node!.prev).not.toBe(null);
                expect(node!.prev!.key).toBe(1);
                expect(node!.prev!.prev).toBe(null);
            });
        });
    });
});
