// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { relativeUriFragment, uriBasename } from "#core/uri.js";
import { MarkdownString, ThemeIcon, TreeItemCollapsibleState, Uri } from "vscode";
import type { Entry } from "../../../model/entry";
import type { LogFile } from "../../../model/logFile";
import type { CanonicalUri } from "../../../services/canonicalPaths";
import { formatPosition } from "../../../vscode/position";
import { BaseNode } from "../../common/baseNode";
import { createTreeItem } from "../../createTreeItem";
import type { FilesTreeDataProvider } from "../filesTreeDataProvider";
import type { GroupNode } from "./groupNode";

/**
 * An abstract base class for an entry within a group.
 */
export abstract class EntryNode<TEntry extends Entry> extends BaseNode {
    constructor(parent: GroupNode<TEntry>, readonly entry: TEntry) {
        super(parent.provider, parent);
        this.recordEntry();
    }

    /**
     * Gets the provider that provides this node.
     */
    get provider(): FilesTreeDataProvider { return super.provider as FilesTreeDataProvider; }

    /**
     * Gets the parent `GroupNode` for the entry.
     */
    get parent(): GroupNode<TEntry> { return super.parent as GroupNode<TEntry>; }

    /**
     * Gets the canonical path to the file for the entry.
     */
    get file(): CanonicalUri { return this.parent.file; }

    /**
     * Gets the base path to the file for the entry.
     */
    get base(): Uri | undefined { return this.parent.base; }

    /**
     * Gets the `LogFile` associated with this node.
     */
    get log(): LogFile { return this.parent.log; }

    /**
     * Gets the formatted label to show in the visual `TreeItem` for this node.
     */
    protected abstract formatLabel(): string;

    /**
     * Record this entry in the provider for faster lookups.
     */
    protected abstract recordEntry(): void;

    /**
     * Gets the formatted description to show in the visual `TreeItem` for this node.
     */
    protected formatDescription(): string {
        const { range } = this.entry.pickReferenceLocation(this.file);
        let relative = this.log.sourcePaths.has(this.file) && this.base ? relativeUriFragment(this.base, this.file) : undefined;
        if (relative && /^\.[\\/]/.test(relative)) {
            relative = relative.slice(2);
        }
        return `${relative || uriBasename(this.file)}${formatPosition(range.start)}`;
    }

    /**
     * Gets the formatted tool tip to show in the visual `TreeItem` for this node (defaults to the label).
     */
    protected formatTooltip(): string | MarkdownString | undefined {
        return this.formatLabel();
    }

    protected iconPath?(): string | Uri | { light: string | Uri; dark: string | Uri } | ThemeIcon | undefined;

    protected createTreeItem() {
        const referenceLocation = this.entry.pickReferenceLocation(this.file);
        return createTreeItem(this.formatLabel(), TreeItemCollapsibleState.None, {
            contextValue: `${this.entry.kind}-entry`,
            description: this.formatDescription?.(),
            tooltip: this.formatTooltip(),
            iconPath: this.iconPath?.(),
            command: referenceLocation && {
                title: "",
                command: "vscode.open",
                arguments: [
                    referenceLocation.uri,
                    {
                        preview: true,
                        selection: referenceLocation.range
                    }
                ]
            }
        });
    }
}
