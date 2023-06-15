// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { count } from "@esfx/iter-fn";
import { markdown } from "#core/markdown.js";
import { IcState } from "#v8/enums/icState.js";
import { CancellationToken, ProviderResult, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import type { Entry } from "../../model/entry";
import type { FileEntry } from "../../model/fileEntry";
import type { LogFile } from "../../model/logFile";
import type { CanonicalUri } from "../../services/canonicalPaths";
import { formatUri } from "../../vscode/uri";
import { BaseNode } from "../common/baseNode";
import { createTreeItem } from "../createTreeItem";
import { CategoryNode } from "./common/categoryNode";
import { DeoptCategoryNode } from "./deopt/deoptCategoryNode";
import type { FilesTreeDataProvider } from "./filesTreeDataProvider";
import { FunctionCategoryNode } from "./function/functionCategoryNode";
import { IcCategoryNode } from "./ic/icCategoryNode";

/**
 * Represents a script file in a log file.
 */
export class FileNode extends BaseNode {
    constructor(
        provider: FilesTreeDataProvider,
        readonly log: LogFile,
        readonly file: CanonicalUri,
        readonly fileEntry: FileEntry,
        readonly base: Uri | undefined,
    ) {
        super(provider, /*parent*/ undefined);
        provider.fileNodes.set(file, this);
    }

    /**
     * Gets the provider that provides this node.
     */
    get provider(): FilesTreeDataProvider { return super.provider as FilesTreeDataProvider; }

    /**
     * Gets the parent node for the file.
     */
    get parent(): undefined { return undefined; }

    protected createTreeItem() {
        return createTreeItem(this.file, this.log.files.size > 1 ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.Expanded, {
            contextValue: "file",
            description: this.log.tryGetRelativeUriFragment(this.file, { ignoreIfBasename: true }),
            iconPath: ThemeIcon.File,
            command: {
                title: "",
                command: "vscode.open",
                arguments: [this.file]
            }
        });
    }

    resolveTreeItem(treeItem: TreeItem, token: CancellationToken): ProviderResult<TreeItem> {
        const megamorphicIcCount = count(this.fileEntry.ics, ic => ic.getWorstIcState() === IcState.MEGAMORPHIC);
        const deoptCount = this.fileEntry.deopts.length;
        treeItem.tooltip = markdown`${[
            markdown`${formatUri(this.file, { as: "file" })}  \n`,
            markdown`**Megamorphic ICs:** ${megamorphicIcCount}  \n`,
            markdown`**Deopts:** ${deoptCount}`
        ]}`;
        return treeItem;
    }

    protected * getChildren(): Iterable<BaseNode> {
        yield new FunctionCategoryNode(this, [...this.fileEntry.functions.values()]);
        yield new IcCategoryNode(this, [...this.fileEntry.ics.values()]);
        yield new DeoptCategoryNode(this, [...this.fileEntry.deopts.values()]);
    }

    /**
     * Finds the conceptual tree node corresponding to the provided entry.
     */
    async findNode(entry: Entry) {
        for (const child of await this.children) {
            if (child instanceof CategoryNode && child.kind === entry.kind) {
                const node = await child.findNode(entry);
                if (node) return node;
            }
        }
    }
}
