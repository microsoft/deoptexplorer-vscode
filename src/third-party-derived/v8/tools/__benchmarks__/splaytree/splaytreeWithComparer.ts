// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
//
// THIRD PARTY LICENSE NOTICE:
//
// Portions of this code are sourced from V8:
//
// Copyright 2009 the V8 project authors. All rights reserved.
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
//       copyright notice, this list of conditions and the following
//       disclaimer in the documentation and/or other materials provided
//       with the distribution.
//     * Neither the name of Google Inc. nor the names of its
//       contributors may be used to endorse or promote products derived
//       from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

import { Comparer, Comparison } from "@esfx/equatable";

/**
 * Constructs a Splay tree.  A splay tree is a self-balancing binary
 * search tree with the additional property that recently accessed
 * elements are quick to access again. It performs basic operations
 * such as insertion, look-up and removal in O(log(n)) amortized time.
 */
export class SplayTree<K, V> {
    /**
     * Pointer to the root node of the tree.
     */
    private root_: SplayTree.Node<K, V> | null = null;
    private compare_: Comparison<K>;
    private head_: SplayTree.Node<K, V>;
    private tail_: SplayTree.Node<K, V>;

    constructor(comparer: Comparer<K> | Comparison<K> = defaultComparison) {
        this.compare_ = typeof comparer === "function" ? comparer : ((a, b) => comparer.compare(a, b));
        const sentinel = new Node<any, any>(undefined, undefined);
        sentinel["tree_"] = this;
        sentinel["prev_"] = sentinel;
        this.head_ = sentinel;
        this.tail_ = sentinel;
    }

    clear() {
        this.root_ = null;
        let next: SplayTree.Node<K, V> | null = null;
        for (let node = this.head_["next_"]; node !== null; node = next) {
            next = node["next_"];
            node["tree_"] = null;
            node["left_"] = null;
            node["right_"] = null;
            node["next_"] = null;
            node["prev_"] = null;
        }
        this.head_["tree_"] = this;
        this.head_["next_"] = null;
        this.head_["prev_"] = this.head_;
        this.tail_ = this.head_;
    }

    /**
     * @return whether the tree is empty
     */
    isEmpty() { return !this.root_; }

    /**
     * Inserts a node into the tree with the specified key and value if
     * the tree does not already contain a node with the specified key. If
     * the value is inserted, it becomes the root of the tree.
     *
     * @param key Key to insert into the tree.
     * @param value Value to insert into the tree.
     */
    insert(key: K, value: V) {
        if (!this.root_) {
            const node = new Node<K, V>(key, value);
            node["tree_"] = this;
            node["prev_"] = this.tail_;
            this.tail_["next_"] = node;
            this.tail_ = node;
            this.root_ = node;
            return;
        }
        // Splay on the key to move the last node on the search path for
        // the key to the root of the tree.
        this.splay_(key);
        const cmp = this.compare_(key, this.root_.key);
        if (cmp === 0) {
            return;
        }
        const node = new Node<K, V>(key, value);
        node["tree_"] = this;
        if (cmp > 0) {
            node["left_"] = this.root_;
            node["right_"] = this.root_["right_"];
            this.root_["right_"] = null;

            node["prev_"] = this.root_;
            node["next_"] = node["prev_"]["next_"];
            node["prev_"]["next_"] = node;
            if (!node["next_"]) {
                this.tail_ = node;
            }
            else {
                node["next_"]["prev_"] = node;
            }
        }
        else {
            node["right_"] = this.root_;
            node["left_"] = this.root_["left_"];
            this.root_["left_"] = null;

            if (!this.root_["prev_"]) throw new Error("Illegal state");
            node["next_"] = this.root_;
            node["prev_"] = node["next_"]["prev_"]!;
            node["next_"]["prev_"] = node;
            node["prev_"]["next_"] = node;
        }
        this.root_ = node;
    }

    /**
     * Removes a node with the specified key from the tree if the tree
     * contains a node with this key. The removed node is returned. If the
     * key is not found, `null` is returned.
     *
     * @param key Key to find and remove from the tree.
     * @return The removed node.
     */
    remove(key: K) {
        if (!this.root_) {
            return null;
        }
        this.splay_(key);
        if (this.compare_(this.root_.key, key) !== 0) {
            return null;
        }
        const removed = this.root_;
        if (!this.root_["left_"]) {
            this.root_ = this.root_["right_"];
        }
        else {
            var right = this.root_["right_"];
            this.root_ = this.root_["left_"];
            // Splay to make sure that the new root has an empty right child.
            this.splay_(key);
            // Insert the original right child as the right child of the new
            // root.
            this.root_["right_"] = right;
        }
        removed["left_"] = null;
        removed["right_"] = null;
        if (!removed["prev_"]) throw new Error("Illegal state");
        if (removed["next_"]) {
            removed["next_"]["prev_"] = removed["prev_"];
        }
        else {
            if (this.tail_ !== removed) throw new Error("Illegal state");
            this.tail_ = removed["prev_"];
        }
        removed["prev_"]["next_"] = removed["next_"];
        removed["next_"] = removed["prev_"];
        removed["prev_"] = null;
        removed["tree_"] = null;
        return removed;
    }

    /**
     * Returns the node having the specified key or null if the tree doesn't contain
     * a node with the specified key.
     *
     * @param key Key to find in the tree.
     * @return Node having the specified key.
     */
    find(key: K) {
        if (!this.root_) {
            return null;
        }
        this.splay_(key);
        return this.compare_(key, this.root_.key) === 0 ? this.root_ : null;
    }

    /**
     * @return Node having the minimum key value.
     */
    findMin(startNode?: SplayTree.Node<K, V> | null) {
        if (this.root_ === null) {
            return null;
        }
        if (startNode === undefined || startNode === null) {
            return this.head_.next;
        }
        let current = startNode;
        if (current["tree_"] !== this) {
            throw new Error("Wrong tree");
        }
        while (current["left_"]) {
            current = current["left_"];
        }
        return current;
    }

    /**
     * @return Node having the maximum key value.
     */
    findMax(startNode?: SplayTree.Node<K, V> | null) {
        if (!this.root_) {
            return null;
        }
        if (startNode === undefined || startNode === null) {
            return this.head_ !== this.tail_ ? this.tail_ : null;
        }
        let current = startNode;
        if (current["tree_"] !== this) {
            throw new Error("Wrong tree");
        }
        while (current["right_"]) {
            current = current["right_"];
        }
        return current;
    }

    /**
     * @return Node having the maximum key value that
     *     is less or equal to the specified key value.
     */
    findGreatestLessThan(key: K) {
        if (!this.root_) {
            return null;
        }
        // Splay on the key to move the node with the given key or the last
        // node on the search path to the top of the tree.
        this.splay_(key);
        // Now the result is either the root node or the greatest node in
        // the left subtree.
        if (this.compare_(this.root_.key, key) <= 0) {
            return this.root_;
        }
        else if (this.root_["left_"]) {
            return this.findMax(this.root_["left_"]);
        }
        else {
            return null;
        }
    }

    /**
     * @return Node having the minimum key value that
     *     is greater than or equal to the specified key value.
     */
    findLeastGreaterThan(key: K) {
        if (!this.root_) {
            return null;
        }
        // Splay on the key to move the node with the given key or the last
        // node on the search path to the top of the tree.
        this.splay_(key);
        // Now the result is either the root node or the greatest node in
        // the left subtree.
        if (this.compare_(this.root_.key, key) >= 0) {
            return this.root_;
        }
        else if (this.root_["right_"]) {
            return this.findMin(this.root_["right_"]);
        }
        else {
            return null;
        }
    }

    /**
     * @return An array containing all the values of tree's nodes paired
     *     with keys.
     */
    exportKeysAndValues() {
        let result: [K, V][] = [];
        this.traverse_(node => result.push([node.key, node.value]));
        return result;
    }

    /**
     * @return An array containing all the values of tree's nodes.
     */
    exportValues() {
        let result: V[] = [];
        this.traverse_(node => result.push(node.value));
        return result;
    }

    /**
     * Perform the splay operation for the given key. Moves the node with
     * the given key to the top of the tree.  If no node has the given
     * key, the last node on the search path is moved to the top of the
     * tree. This is the simplified top-down splaying algorithm from:
     * "Self-adjusting Binary Search Trees" by Sleator and Tarjan
     *
     * @param key Key to splay the tree on.
     * @private
     */
    private splay_(key: K) {
        if (!this.root_) {
            return;
        }
        // Create a dummy node.  The use of the dummy node is a bit
        // counter-intuitive: The right child of the dummy node will hold
        // the L tree of the algorithm.  The left child of the dummy node
        // will hold the R tree of the algorithm.  Using a dummy node, left
        // and right will always be nodes and we avoid special cases.
        let dummy: SplayTree.Node<K, V>;
        let left: SplayTree.Node<K, V>;
        let right: SplayTree.Node<K, V>;
        dummy = left = right = new Node<K, V>(null!, null!);
        let current = this.root_;
        const compare = this.compare_;
        while (true) {
            const cmp = compare(key, current.key);
            if (cmp < 0) {
                if (!current["left_"]) {
                    break;
                }
                if (compare(key, current["left_"].key) < 0) {
                    // Rotate right.
                    var tmp = current["left_"];
                    current["left_"] = tmp["right_"];
                    tmp["right_"] = current;
                    current = tmp;
                    if (!current["left_"]) {
                        break;
                    }
                }
                // Link right.
                right["left_"] = current;
                right = current;
                current = current["left_"];
            }
            else if (cmp > 0) {
                if (!current["right_"]) {
                    break;
                }
                if (compare(key, current["right_"].key) > 0) {
                    // Rotate left.
                    let tmp = current["right_"];
                    current["right_"] = tmp["left_"];
                    tmp["left_"] = current;
                    current = tmp;
                    if (!current["right_"]) {
                        break;
                    }
                }
                // Link left.
                left["right_"] = current;
                left = current;
                current = current["right_"];
            }
            else {
                break;
            }
        }
        // Assemble.
        left["right_"] = current["left_"];
        right["left_"] = current["right_"];
        current["left_"] = dummy["right_"];
        current["right_"] = dummy["left_"];
        this.root_ = current;
    }

    /**
     * Performs a preorder traversal of the tree.
     *
     * @param f Visitor function.
     * @private
     */
    private traverse_(f: (node: SplayTree.Node<K, V>) => void) {
        let nodesToVisit = [this.root_];
        while (nodesToVisit.length > 0) {
            var node = nodesToVisit.shift();
            if (node === null || node === undefined) {
                continue;
            }
            f(node);
            nodesToVisit.push(node["left_"]);
            nodesToVisit.push(node["right_"]);
        }
    }

    * keys(startNode?: SplayTree.Node<K, V> | null, reverse = false) {
        if (startNode && startNode["tree_"] !== this) {
            throw new Error("Wrong tree");
        }
        if (reverse) {
            startNode ??= this.tail_ !== this.head_ ? this.tail_ : null;
            for (let current = startNode; current !== null; current = current.prev) {
                yield current.key;
            }
        }
        else {
            startNode ??= this.head_.next;
            for (let current = startNode; current; current = current.next) {
                yield current.key;
            }
        }
    }

    * values(startNode?: SplayTree.Node<K, V> | null, reverse = false) {
        if (startNode && startNode["tree_"] !== this) {
            throw new Error("Wrong tree");
        }
        if (reverse) {
            startNode ??= this.tail_ !== this.head_ ? this.tail_ : null;
            for (let current = startNode; current !== null; current = current.prev) {
                yield current.value;
            }
        }
        else {
            startNode ??= this.head_.next;
            for (let current = startNode; current; current = current.next) {
                yield current.value;
            }
        }
    }

    * entries(startNode?: SplayTree.Node<K, V> | null, reverse = false) {
        if (startNode && startNode["tree_"] !== this) {
            throw new Error("Wrong tree");
        }
        if (reverse) {
            startNode ??= this.tail_ !== this.head_ ? this.tail_ : null;
            for (let current = startNode; current !== null; current = current.prev) {
                yield [current.key, current.value] as [K, V];
            }
        }
        else {
            startNode ??= this.head_.next;
            for (let current = startNode; current; current = current.next) {
                yield [current.key, current.value] as [K, V];
            }
        }
    }

    [Symbol.iterator]() {
        return this.entries();
    }
}

export namespace SplayTree {
    export class Node<K, V> {
        private tree_: SplayTree<K, V> | null = null;
        private left_: Node<K, V> | null = null;
        private right_: Node<K, V> | null = null;

        /**
         * The next node in key order.
         * If this is the largest key in the tree, this will be the node itself.
         * If this node is no longer in the tree, this will be the next node in traversal order.
         */
        private next_: Node<K, V> | null = null;

        /**
         * The previous node in key order.
         * If this is the smallest key in the tree, this will be the node itself.
         * If this node is no longer in the tree, this will be null.
         */
        private prev_: Node<K, V> | null = null;

        public readonly key: K;
        public value: V;

        /**
         * Constructs a Splay tree node.
         *
         * @param key Key.
         * @param value Value.
         */
        constructor(key: K, value: V) {
            this.key = key;
            this.value = value;
        }

        get tree(): SplayTree<K, V> | null { return this.tree_; }
        get left(): Node<K, V> | null { return this.left_; }
        get right(): Node<K, V> | null { return this.right_; }
        get next(): Node<K, V> | null { return getNext(this); }
        get prev(): Node<K, V> | null { return getPrev(this); }
    }
}

const Node = SplayTree.Node;

function defaultComparison<K>(a: K, b: K) { return a < b ? -1 : a > b ? +1 : 0; }

function getNext<K, V>(node: SplayTree.Node<K, V> | null) {
    while (node) {
        const skipNext = !node["prev_"];
        node = node["next_"];
        if (skipNext) {
            continue;
        }
        return node;
    }
    return null;
}

function getPrev<K, V>(node: SplayTree.Node<K, V> | null) {
    while (node) {
        const prev = node["prev_"];
        if (!prev) {
            node = getNext(node);
            continue;
        }
        if (prev === prev["prev_"]) {
            // sentinel
            break;
        }
        return prev;
    }
    return null;
}
