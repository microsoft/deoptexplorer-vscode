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

import { assert, fail } from "#core/assert.js";
import { ProfileShowMode } from "#extension/constants.js";
import { CallTree, CallTreeNode } from "./calltree";
import { CodeEntry } from "./codeentry";
import { ConsArray } from "./consarray";
import { LineTick } from "./types";

/**
 * Creates a Profile View builder object.
 *
 * @param samplingRate Number of ms between profiler ticks.
 */
export class ViewBuilder {
    constructor(
        public samplingRate: number
    ) { }

    /**
     * Builds a profile view for the specified call tree.
     *
     * @param callTree A call tree.
     */
    buildView(callTree: CallTree, showAs: ProfileShowMode) {
        return showAs === ProfileShowMode.CallTree ? this._buildCallTreeView(callTree) :
            showAs === ProfileShowMode.BottomUp ? this._buildBottomUpView(callTree) :
            showAs === ProfileShowMode.Flat ? this._buildFlatView(callTree) :
            fail("Argument out of range: showAs");
    }

    private _buildCallTreeView(callTree: CallTree) {
        let head: ProfileViewNode | undefined;
        callTree.computeTotalWeights();
        callTree.traverse<ProfileViewNode>((node, viewParent) => {
            let totalWeight = node.totalWeight * this.samplingRate;
            let selfWeight = node.selfWeight * this.samplingRate;
            let viewNode = this.createViewNode(node.entry, totalWeight, selfWeight, node.getLineTicks(), head);
            if (viewParent) {
                viewParent.addChild(viewNode);
            } else {
                head = viewNode;
            }
            return viewNode;
        });
        assert(head);
        return this.createView(head);
    }

    private _buildBottomUpView(callTree: CallTree) {
        callTree.computeTotalWeights();

        // In the bottom-up view, we invert the parent-child relationship:
        //
        // Call stacks (top, ..., bottom):
        //  A,B,C
        //  A,D,C
        //  A,D,E
        //
        // Top-down tree:
        //
        //            B - C (bottom)
        //           /
        // (root) - A (top)
        //           \
        //            D - C (bottom)
        //             \
        //              E (bottom)
        //
        // Bottom-up tree:
        //
        //           B - A (top)
        //          /
        //         C (bottom)
        //        / \
        //       /   D - A (top)
        // (root)
        //       \
        //        \
        //         E (bottom)
        //          \
        //           D - A (top)
        //
        // This can result in a recursive tree, so we defer population of child nodes.

        const topDownRoot = callTree.getRoot();
        const bottomNodes = new Set<BottomUpProfileViewNodeTemplate>();
        const nodeMap = new Map<string, BottomUpProfileViewNodeTemplate>();

        function* collectStacks(node: CallTreeNode, stack: CallTreeNode[]): Generator<CallTreeNode[]> {
            // do not add the root node to the stack
            if (node.parent) {
                stack = stack.concat([node]);
                if (node.selfWeight > 0) yield stack;
            }
            for (const child of node.childNodes()) {
                yield* collectStacks(child, stack);
            }
        }

        let next_id = 0;
        const seen = new Set<CallTreeNode>();
        for (const stack of collectStacks(topDownRoot, [])) {
            // The first element of each stack is the top frame (outermost caller)
            // The last element of each stack is the bottom frame (innermost callee)
            // In the bottom up stack, a parent node is a callee and a child node is a caller
            let callee: CallTreeNode | undefined;
            let calleeTemplate: BottomUpProfileViewNodeTemplate | undefined;
            for (let i = stack.length - 1; i >= 0; i--) {
                const node = stack[i];
                let template = nodeMap.get(node.label);
                if (!template) nodeMap.set(node.label, template = new BottomUpProfileViewNodeTemplate(++next_id, node.entry));
                if (!seen.has(node)) {
                    // aggregate this node
                    seen.add(node);
                    template.selfTime += node.selfWeight * this.samplingRate;
                    for (const { line, hitCount: hit_count } of node.getLineTicks()) {
                        template.lineTicks ??= (Object.create(null) as Record<number, number>);
                        template.lineTicks[line] ??= 0;
                        template.lineTicks[line] += hit_count;
                    }
                }
                if (!callee) {
                    // if this node is the bottom node of the stack, add the template
                    bottomNodes.add(template);
                }
                else {
                    assert(calleeTemplate);
                    template.callees ??= new Set();
                    template.callees.add(calleeTemplate);

                    calleeTemplate.callers ??= new Set();
                    calleeTemplate.callers.add(template);
                }
                callee = node;
                calleeTemplate = template;
            }
        }

        // compute the aggregate total times for each node.
        for (const template of nodeMap.values()) {
            // we recompute for each callee since a node could contain a reference to itself
            // and we need to exclude already covered times.
            template.totalTime = computeBottomUpTotalTime(template, new Set());
        }

        // compute the aggregate caller total times for each node.
        for (const template of nodeMap.values()) {
            // we recompute for each callee since a node could contain a reference to itself
            // and we need to exclude already covered times.
            template.parentTotalTime = computeBottomUpParentTotalTime(template, new Set());
        }

        const bottomUpRoot = new BottomUpProfileViewNode(new BottomUpProfileViewNodeTemplate(
            ++next_id,
            topDownRoot.entry,
            topDownRoot.totalWeight * this.samplingRate,
            topDownRoot.selfWeight * this.samplingRate,
            bottomNodes));

        return this.createView(bottomUpRoot);
    }

    private _buildFlatView(callTree: CallTree) {
        const root = new ProfileViewNode(CodeEntry.root_entry(), 0, 0);
        let rootEntry = root.entry;
        let rootLabel = rootEntry.getName();
        let precs: Record<string, number> = Object.create(null);
        precs[rootLabel] = 0;
        callTree.computeTotalWeights();
        callTree.traverseInDepth(
            node => {
                precs[node.label] ??= 0;
                let nodeLabelIsRootLabel = node.label === rootLabel
                if (nodeLabelIsRootLabel || precs[rootLabel] > 0) {
                    if (precs[rootLabel] === 0) {
                        root["_selfTime"] += node.selfWeight * this.samplingRate;
                        root["_totalTime"] += node.totalWeight * this.samplingRate;
                    }
                    else {
                        let rec = root.findChild(node.entry);
                        if (!rec) {
                            // TODO: Flat line ticks
                            rec = new ProfileViewNode(node.entry, 0, 0, [], root);
                            root.addChild(rec);
                        }
                        rec["_selfTime"] += node.selfWeight * this.samplingRate;
                        if (nodeLabelIsRootLabel || precs[node.label] == 0) {
                            rec["_totalTime"] += node.totalWeight * this.samplingRate;
                        }
                    }
                    precs[node.label]++;
                }
            },
            node => {
                if (node.label === rootLabel || precs[rootLabel] > 0) {
                    precs[node.label]--;
                }
            });

        return this.createView(root);
    }

    /**
     * Factory method for a profile view.
     *
     * @param head View head node.
     * @return {ProfileView} Profile view.
     */
    createView(head: ProfileViewNode): ProfileView {
        return new ProfileView(head);
    }

    /**
     * Factory method for a profile view node.
     *
     * @param entry The code entry for the node.
     * @param totalTime Amount of time that application spent in the
     *     corresponding function and its descendants (not that depending on
     *     profile they can be either callees or callers.)
     * @param selfTime Amount of time that application spent in the
     *     corresponding function only.
     * @param head Profile view head.
     * @return Profile view node.
     */
    createViewNode(entry: CodeEntry, totalTime: number, selfTime: number, lineTicks: readonly LineTick[], head: ProfileViewNode | undefined): ProfileViewNode {
        return new ProfileViewNode(entry, totalTime, selfTime, lineTicks, head);
    }
}

export class ProfileView {
    /**
     * Creates a Profile View object. It allows to perform sorting
     * and filtering actions on the profile.
     *
     * @param head Head (root) node.
     */
    constructor(
        public head: ProfileViewNode
    ) { }

    /**
     * Sorts the profile view using the specified sort function.
     *
     * @param sortFunc A sorting function. Must comply with Array.sort sorting function requirements.
     */
    sort(sortFunc: (a: ProfileViewNode, b: ProfileViewNode) => number) {
        this.traverse(function (node) {
            node.sortChildren(sortFunc);
        });
    }

    /**
     * Traverses profile view nodes in preorder.
     *
     * @param f Visitor function.
     */
    traverse(f: (node: ProfileViewNode) => void) {
        let nodesToTraverse = new ConsArray<ProfileViewNode>();
        nodesToTraverse.concat([this.head]);
        while (!nodesToTraverse.atEnd()) {
            let node = nodesToTraverse.next();
            if (!node.isCycle) {
                f(node);
                nodesToTraverse.concat(node.children);
            }
        }
    }
}

export class ProfileViewNode {
    readonly token = Symbol();

    parent: ProfileViewNode | null = null;
    private _tokenPath: readonly symbol[] | undefined;
    private _children: ProfileViewNode[] = [];
    private _selfTime: number;
    private _totalTime: number;
    private _lineTicks: readonly ProfileViewLineTickNode[];

    /**
     * Constructs a Profile View node object. Each node object corresponds to
     * a function call.
     *
     * @param internalFuncName A fully qualified function name.
     * @param totalTime Amount of time that application spent in the
     *     corresponding function and its descendants (not that depending on
     *     profile they can be either callees or callers.)
     * @param selfTime Amount of time that application spent in the
     *     corresponding function only.
     * @param head Profile view head.
     */
    constructor(
        readonly entry: CodeEntry,
        totalTime: number,
        selfTime: number,
        lineTicks: readonly LineTick[] = [],
        public head: ProfileViewNode | null = null
    ) {
        this._totalTime = totalTime;
        this._selfTime = selfTime;
        this._lineTicks = lineTicks.map(({ line, hitCount: hit_count }) => new ProfileViewLineTickNode(this, line, hit_count));
    }

    get tokenPath(): readonly symbol[] { return this._tokenPath ?? (this.parent ? this.parent.tokenPath.concat(this.token) : [this.token]); }
    get totalTime() { return this._totalTime; }
    get totalPercent() { return this.head ? this.totalTime * 100.0 / this.head.totalTime : 100.0; }
    get selfTime() { return this._selfTime; }
    get selfPercent() { return this.head ? this.selfTime * 100.0 / this.head.totalTime : 100.0; }

    /**
     * Returns a share of the function's total time in its caller's total time.
     */
    get parentTotalPercent() {
        return this.parent ? this.totalTime * 100.0 / this.parent.totalTime : 100.0;
    }

    get lineTicks() { return this._lineTicks; }

    get internalFuncName() {
        return this.entry.getName();
    }

    get functionName() {
        return this.entry.functionName;
    }

    get children() {
        this.populateChildren();
        return this._children;
    }

    get isCycle() {
        return false;
    }

    /**
     * Adds a child to the node.
     *
     * @param node Child node.
     */
    addChild(node: ProfileViewNode) {
        node.parent = this;
        this._children.push(node);
    }

    findChild(entry: CodeEntry) {
        return this._children.find(child => child.entry === entry);
    }

    /**
     * Sorts all the node's children recursively.
     *
     * @param sortFunc A sorting function. Must comply with Array.sort sorting function requirements.
     */
    sortChildren(sortFunc: (a: ProfileViewNode, b: ProfileViewNode) => number) {
        this.children.sort(sortFunc);
    }

    protected populateChildren(): void {
    }
}

export class ProfileViewLineTickNode {
    constructor(
        readonly parent: ProfileViewNode,
        readonly line: number,
        readonly hitCount: number
    ) {
    }
}

class BottomUpProfileViewNodeTemplate {
    callees: Set<BottomUpProfileViewNodeTemplate> | undefined;
    lineTicks: Record<number, number> | undefined;
    constructor(
        public id: number,
        public entry: CodeEntry,
        public totalTime = 0,
        public selfTime = 0,
        public callers: Set<BottomUpProfileViewNodeTemplate> | undefined = undefined,
        public parentTotalTime: number | undefined = undefined,
    ) {
    }
}

// Compute the total time of the callees of this node, excluding this node
function computeBottomUpTotalTime(template: BottomUpProfileViewNodeTemplate, seen: Set<BottomUpProfileViewNodeTemplate>): number {
    if (seen.has(template)) return 0;
    seen.add(template);
    let totalTime = template.selfTime;
    if (template.callees) {
        for (const child of template.callees) {
            totalTime += computeBottomUpTotalTime(child, seen);
        }
    }
    return totalTime;
}

function computeBottomUpParentTotalTime(template: BottomUpProfileViewNodeTemplate, seen: Set<BottomUpProfileViewNodeTemplate>): number {
    let totalTime = 0;
    if (template.callers) {
        for (const caller of template.callers) {
            totalTime += computeBottomUpTotalTime(caller, seen);
        }
    }
    return totalTime || template.totalTime;
}

class BottomUpProfileViewNode extends ProfileViewNode {
    private _remaining: Set<BottomUpProfileViewNodeTemplate> | undefined;
    private _parentTotalTime: number | undefined;
    private _id: number;
    private _isCycle: boolean | undefined;

    public declare head: BottomUpProfileViewNode | null;
    public declare parent: BottomUpProfileViewNode | null;

    constructor(template: BottomUpProfileViewNodeTemplate, head?: BottomUpProfileViewNode) {
        super(template.entry, template.totalTime, template.selfTime, LineTick.fromRecord(template.lineTicks), head);
        this._id = template.id;
        this._remaining = template.callers;
        this._parentTotalTime = template.parentTotalTime;
    }

    get parentTotalPercent(): number {
        return this._parentTotalTime === undefined ? 100.0 : this.totalTime * 100.0 / this._parentTotalTime;
    }

    get isCycle() {
        if (!this.head) return false;
        if (this._isCycle !== undefined) return this._isCycle;
        let node = this.parent;
        while (node?.parent?.parent) {
            if (node._id === this._id) return this._isCycle = true;
            node = node.parent;
        }
        return this._isCycle = false;
    }

    protected populateChildren() {
        if (!this._remaining) return;
        if (this.isCycle) return;
        for (const template of this._remaining) {
            const child = new BottomUpProfileViewNode(template, this.head ?? this);
            this.addChild(child);
        }
        this._remaining = undefined;
    }
}
