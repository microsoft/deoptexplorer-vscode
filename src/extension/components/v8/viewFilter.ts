// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CallTree, CallTreeNode } from "#v8/tools/calltree.js";
import { CodeEntry } from "#v8/tools/codeentry.js";

export interface ViewFilterOptions {
    hideNativeCode?: boolean;
    hideNodeJsCode?: boolean;
    hideNodeModulesCode?: boolean;
}

export class ViewFilter {
    readonly hideNativeCode: boolean;
    readonly hideNodeJsCode: boolean;
    readonly hideNodeModulesCode: boolean;

    constructor({ hideNativeCode = false, hideNodeJsCode = false, hideNodeModulesCode = false }: ViewFilterOptions = {}) {
        this.hideNativeCode = hideNativeCode;
        this.hideNodeJsCode = hideNodeJsCode;
        this.hideNodeModulesCode = hideNodeModulesCode;
    }

    skipThisFunction(codeEntry: CodeEntry) {
        if (this.hideNativeCode && (codeEntry.type === "CPP" || codeEntry.type === "SHARED_LIB")) return true;
        if (this.hideNodeJsCode && codeEntry.filePosition?.uri.scheme === "node") return true;
        if (this.hideNodeModulesCode && codeEntry.filePosition?.uri.path.includes("/node_modules/")) return true;
        return false;
    }

    applyFilter(callTree: CallTree) {
        if (!this.hideNativeCode && !this.hideNodeJsCode) return callTree;
        const newCallTree = new CallTree();
        const newRoot = newCallTree.getRoot();
        callTree.traverse<CallTreeNode>((node, parentNode) => {
            const newParent = parentNode || newRoot;
            if (this.skipThisFunction(node.entry)) {
                if (parentNode) {
                    parentNode.selfWeight += node.selfWeight;
                }
                return newParent;
            }
            else {
                let newNode = newParent.findChild(node.entry);
                if (!newNode) {
                    newNode = newParent.addChild(node.entry);
                    newNode.selfWeight = node.selfWeight;
                    for (const lineTick of node.getLineTicks()) {
                        newNode.incrementLineTicks(lineTick.line, lineTick.hitCount);
                    }
                }
                return newNode;
            }
        });
        return newCallTree;
    }
}