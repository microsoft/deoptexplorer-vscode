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

import { assert } from "#core/assert.js";
import { kNoLineNumberInfo } from "../constants";
import { LineTick } from "./types";
import { CodeEntry } from "./codeentry";
import { ConsArray } from "./consarray";
import { ProfileStackTrace } from "../profileStackTrace";

/**
 * Constructs a call graph.
 */
export class CallTree {
    private totalsComputed_ = false;
    private next_id_ = 0;
    private nodes_by_id_ = new Map<number, CallTreeNode>();
    private root_ = new CallTreeNode(this, CodeEntry.root_entry());

    /**
     * Returns the tree root.
     */
    getRoot() {
        return this.root_;
    }

    /**
     * Adds the specified call path in reverse, constructing nodes as necessary.
     *
     * @param path Call path.
     */
    addPathFromEnd(path: ProfileStackTrace, src_line: number) {
        if (path.length == 0) {
            return this.root_;
        }
        let curr = this.root_;
        for (let i = path.length - 1; i >= 0; --i) {
            curr = curr.findOrAddChild(path[i].code_entry);
        }
        curr.incrementSelfTicks();
        curr.incrementLineTicks(src_line);
        this.totalsComputed_ = false;
        return curr;
    }

    /**
     * Finds an immediate child of the specified parent with the specified
     * label, creates a child node if necessary. If a parent node isn't
     * specified, uses tree root.
     */
    findOrAddChild(entry: CodeEntry) {
        return this.root_.findOrAddChild(entry);
    }

    /**
     * Creates a subtree by cloning and merging all subtrees rooted at nodes
     * with a given label. E.g. cloning the following call tree on label 'A'
     * will give the following result:
     *
     *           <A>--<B>                                     <B>
     *          /                                            /
     *     <root>             == clone on 'A' ==>  <root>--<A>
     *          \                                            \
     *           <C>--<A>--<D>                                <D>
     *
     * And <A>'s selfWeight will be the sum of selfWeights of <A>'s from the
     * source call tree.
     *
     * @param label The label of the new root node.
     */
    cloneSubtree(label: string) {
        let subTree = new CallTree();
        this.traverse<CallTreeNode>(function (node, parent) {
            if (!parent && node.label !== label) {
                return null;
            }
            let child = (parent ?? subTree).findOrAddChild(node.entry);
            child.selfWeight += node.selfWeight;
            return child;
        });
        return subTree;
    }

    /**
     * Computes total weights in the call graph.
     */
    computeTotalWeights() {
        if (this.totalsComputed_) {
            return;
        }
        this.root_.computeTotalWeight();
        this.totalsComputed_ = true;
    }

    /**
     * Traverses the call graph in preorder. This function can be used for
     * building optionally modified tree clones. This is the boilerplate code
     * for this scenario:
     *
     * ```js
     * callTree.traverse(function(node, parentClone) {
     *   let nodeClone = cloneNode(node);
     *   if (parentClone)
     *     parentClone.addChild(nodeClone);
     *   return nodeClone;
     * });
     * ```
     *
     * @param f Visitor function. The second parameter is the result of calling 'f' on the parent node.
     */
    traverse<T>(f: (node: CallTreeNode, param: T | null) => T | null) {
        let pairsToProcess = new ConsArray<{ node: CallTreeNode, param: T | null }>();
        pairsToProcess.concat([{ node: this.root_, param: null }]);
        while (!pairsToProcess.atEnd()) {
            let pair = pairsToProcess.next();
            let node = pair.node;
            let newParam = f(node, pair.param);
            let morePairsToProcess: { node: CallTreeNode, param: T | null }[] = [];
            node.forEachChild(child => {
                morePairsToProcess.push({ node: child, param: newParam });
            });
            pairsToProcess.concat(morePairsToProcess);
        }
    }

    /**
     * Performs an indepth call graph traversal.
     *
     * @param enter A function called prior to visiting node's children.
     * @param exit A function called after visiting node's children.
     */
    traverseInDepth(enter: (node: CallTreeNode) => void, exit: (node: CallTreeNode) => void) {
        const traverse = (node: CallTreeNode) => {
            enter(node);
            node.forEachChild(traverse);
            exit(node);
        };
        traverse(this.root_);
    }

    getNodeById(nodeId: number) {
        return this.nodes_by_id_.get(nodeId);
    }

    private next_node_id() { return this.next_id_++; }
}

export class CallTreeNode {
    tree: CallTree;
    entry: CodeEntry;
    id: number;
    parent: CallTreeNode | null;
    children: Record<string, CallTreeNode>;
    private _line_ticks?: Record<number, number>;

    /**
     * Node self weight (how many times this node was the last node in
     * a call path).
     */
    selfWeight = 0;

    /**
     * Node total weight (includes weights of all children).
     */
    totalWeight = 0;

    /**
     * Constructs a call graph node.
     *
     * @param entry Node label.
     * @param opt_parent Node parent.
     */
    constructor(tree: CallTree, entry: CodeEntry, opt_parent: CallTreeNode | null = null) {
        this.tree = tree;
        this.entry = entry;
        this.id = tree["next_node_id"]();
        this.parent = opt_parent;
        this.children = Object.create(null);
        tree["nodes_by_id_"].set(this.id, this);
    }

    get label() {
        return this.entry.getName();
    }

    incrementSelfTicks() {
        this.selfWeight++;
    }

    incrementLineTicks(src_line: number, amount = 1) {
        assert(src_line >= kNoLineNumberInfo);
        assert(amount >= 1);
        if (src_line === kNoLineNumberInfo) return;
        this._line_ticks ??= Object.create(null) as Record<number, number>;
        this._line_ticks[src_line] ??= 0;
        this._line_ticks[src_line] += amount;
    }

    getLineTicks() {
        return LineTick.fromRecord(this._line_ticks);
    }

    /**
     * Adds a child node.
     *
     * @param entry Child code entry.
     */
    addChild(entry: CodeEntry) {
        let child = new CallTreeNode(this.tree, entry, this);
        this.children[child.label] = child;
        return child;
    }

    /**
     * Computes node's total weight.
     */
    computeTotalWeight() {
        let totalWeight = this.selfWeight;
        this.forEachChild(child => {
            totalWeight += child.computeTotalWeight();
        });
        return this.totalWeight = totalWeight;
    }

    /**
     * Returns all node's children as an array.
     */
    exportChildren() {
        let result: CallTreeNode[] = [];
        this.forEachChild(node => result.push(node));
        return result;
    }

    /**
     * Finds an immediate child with the specified label.
     *
     * @param label Child node label.
     */
    findChild(entry: CodeEntry): CallTreeNode | null {
        return this.children[entry.getName()] || null;
    }

    /**
     * Finds an immediate child with the specified label, creates a child
     * node if necessary.
     */
    findOrAddChild(entry: CodeEntry) {
        return this.findChild(entry) || this.addChild(entry);
    }

    /**
     * Calls the specified function for every child.
     *
     * @param f Visitor function.
     */
    forEachChild(f: (node: CallTreeNode) => void) {
        for (const child of this.childNodes()) {
            f(child);
        }
    }

    * childNodes() {
        for (let c in this.children) {
            yield this.children[c];
        }
    }

    /**
     * Walks up from the current node up to the call tree root.
     *
     * @param f Visitor function.
     */
    walkUpToRoot(f: (node: CallTreeNode) => void) {
        for (let curr: CallTreeNode | null = this; curr !== null; curr = curr.parent) {
            f(curr);
        }
    }

    /**
     * Tries to find a node with the specified path.
     *
     * @param entries The path.
     * @param opt_f Visitor function.
     */
    descendToChild(entries: CodeEntry[], opt_f?: (node: CallTreeNode, pos: number) => void): CallTreeNode | null {
        let curr: CallTreeNode | null = this;
        for (let pos = 0; pos < entries.length && curr !== null; pos++) {
            let child: CallTreeNode | null = curr.findChild(entries[pos]);
            if (child !== null && opt_f) {
                opt_f(child, pos);
            }
            curr = child;
        }
        return curr;
    }
}
