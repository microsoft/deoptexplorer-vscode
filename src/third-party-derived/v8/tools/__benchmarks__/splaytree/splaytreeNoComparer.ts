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

/**
 * Constructs a Splay tree.  A splay tree is a self-balancing binary
 * search tree with the additional property that recently accessed
 * elements are quick to access again. It performs basic operations
 * such as insertion, look-up and removal in O(log(n)) amortized time.
 */
export class SplayTree<K, T> {
    /**
     * Pointer to the root node of the tree.
     */
    private root_: SplayTree.Node<K, T> | null = null;

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
    insert(key: K, value: T) {
        if (!this.root_) {
            this.root_ = new SplayTree.Node<K, T>(key, value);
            return;
        }
        // Splay on the key to move the last node on the search path for
        // the key to the root of the tree.
        this.splay_(key);
        if (this.root_.key === key) {
            return;
        }
        let node = new SplayTree.Node<K, T>(key, value);
        if (key > this.root_.key) {
            node.left = this.root_;
            node.right = this.root_.right;
            this.root_.right = null;
        }
        else {
            node.right = this.root_;
            node.left = this.root_.left;
            this.root_.left = null;
        }
        this.root_ = node;
    }

    /**
     * Removes a node with the specified key from the tree if the tree
     * contains a node with this key. The removed node is returned. If the
     * key is not found, an exception is thrown.
     *
     * @param key Key to find and remove from the tree.
     * @return The removed node.
     */
    remove(key: K) {
        if (!this.root_) {
            throw Error(`Key not found: ${key}`);
        }
        this.splay_(key);
        if (this.root_.key !== key) {
            throw Error(`Key not found: ${key}`);
        }
        let removed = this.root_;
        if (!this.root_.left) {
            this.root_ = this.root_.right;
        }
        else {
            var right = this.root_.right;
            this.root_ = this.root_.left;
            // Splay to make sure that the new root has an empty right child.
            this.splay_(key);
            // Insert the original right child as the right child of the new
            // root.
            this.root_.right = right;
        }
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
        return this.root_.key === key ? this.root_ : null;
    }

    /**
     * @return Node having the minimum key value.
     */
    findMin(opt_startNode?: SplayTree.Node<K, T>) {
        if (!this.root_) {
            return null;
        }
        let current = opt_startNode || this.root_;
        while (current.left) {
            current = current.left;
        }
        return current;
    }

    /**
     * @return Node having the maximum key value.
     */
    findMax(opt_startNode?: SplayTree.Node<K, T>) {
        if (!this.root_) {
            return null;
        }
        let current = opt_startNode || this.root_;
        while (current.right) {
            current = current.right;
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
        if (this.root_.key <= key) {
            return this.root_;
        }
        else if (this.root_.left) {
            return this.findMax(this.root_.left);
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
        if (this.root_.key >= key) {
            return this.root_;
        }
        else if (this.root_.right) {
            return this.findMin(this.root_.right);
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
        let result: [K, T][] = [];
        this.traverse_(node => result.push([node.key, node.value]));
        return result;
    }

    /**
     * @return An array containing all the values of tree's nodes.
     */
    exportValues() {
        let result: T[] = [];
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
        let dummy: SplayTree.Node<K, T>;
        let left: SplayTree.Node<K, T>;
        let right: SplayTree.Node<K, T>;
        dummy = left = right = new SplayTree.Node<K, T>(null!, null!);
        let current = this.root_;
        while (true) {
            if (key < current.key) {
                if (!current.left) {
                    break;
                }
                if (key < current.left.key) {
                    // Rotate right.
                    var tmp = current.left;
                    current.left = tmp.right;
                    tmp.right = current;
                    current = tmp;
                    if (!current.left) {
                        break;
                    }
                }
                // Link right.
                right.left = current;
                right = current;
                current = current.left;
            }
            else if (key > current.key) {
                if (!current.right) {
                    break;
                }
                if (key > current.right.key) {
                    // Rotate left.
                    let tmp = current.right;
                    current.right = tmp.left;
                    tmp.left = current;
                    current = tmp;
                    if (!current.right) {
                        break;
                    }
                }
                // Link left.
                left.right = current;
                left = current;
                current = current.right;
            }
            else {
                break;
            }
        }
        // Assemble.
        left.right = current.left;
        right.left = current.right;
        current.left = dummy.right;
        current.right = dummy.left;
        this.root_ = current;
    }

    /**
     * Performs a preorder traversal of the tree.
     *
     * @param f Visitor function.
     * @private
     */
    private traverse_(f: (node: SplayTree.Node<K, T>) => void) {
        let nodesToVisit = [this.root_];
        while (nodesToVisit.length > 0) {
            var node = nodesToVisit.shift();
            if (node === null || node === undefined) {
                continue;
            }
            f(node);
            nodesToVisit.push(node.left);
            nodesToVisit.push(node.right);
        }
    }
}

export namespace SplayTree {
    export class Node<K, T> {
        left: Node<K, T> | null = null;
        right: Node<K, T> | null = null;

        /**
         * Constructs a Splay tree node.
         *
         * @param key Key.
         * @param value Value.
         */
        constructor(
            public key: K,
            public value: T
        ) {
        }
    }
}
