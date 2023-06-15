// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { markdown } from "#core/markdown.js";
import { FunctionState } from "#v8/enums/functionState.js";
import { DynamicFuncCodeEntry } from "#v8/tools/codeentry.js";
import type { ProfileViewNode } from "#v8/tools/profile_view.js";
import { CancellationToken, SymbolKind, ThemeIcon, TreeItem, TreeItemCollapsibleState, window } from "vscode";
import * as constants from "../../constants";
import { getScriptSourceUri } from "../../fileSystemProviders/scriptSourceFileSystemProvider";
import { formatMilliseconds } from "../../formatting/numbers";
import { ProfileViewNodeSnapshot } from "../../model/profileViewNodeSnapshot";
import { setShowDecorations, setShowLineTicks, showDecorations } from "../../services/context";
import { setCurrentProfileViewNodeSnapshot } from "../../services/stateManager";
import { typeSafeCommand } from "../../vscode/commands";
import { formatLocation } from "../../vscode/location";
import { BaseNode } from "../common/baseNode";
import { createTreeItem } from "../createTreeItem";
import { getUriForProfileNode } from "./profileNodeFileDecorationProvider";
import type { ProfileTreeDataProvider } from "./profileTreeDataProvider";

/**
 * Represents a conceptual tree node for a cpu profile node.
 */
export class ProfileNode extends BaseNode {
    constructor(
        provider: ProfileTreeDataProvider,
        readonly node: ProfileViewNode,
        readonly forNodes?: readonly ProfileViewNode[]
    ) {
        super(provider, /*parent*/ undefined, { });
    }

    /**
     * Gets the provider that provides this node.
     */
    get provider(): ProfileTreeDataProvider { return super.provider as ProfileTreeDataProvider; }

    /**
     * Gets the parent of the this node.
     */
    get parent(): undefined { return undefined; }

    protected createTreeItem(): TreeItem {
        const { entry, functionName } = this.node;
        const location = entry.filePosition && entry.pickLocation(entry.filePosition.uri) || functionName.filePosition;
        const collapsibleState = this.node.children.length ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None;
        return createTreeItem(functionName.name, collapsibleState, {
            contextValue: location && this.node.lineTicks.length ? "profile-node+ticks" : "profile-node",
            resourceUri: getUriForProfileNode(this.node),
            iconPath: this.getIconPath(),
            description:
                this.provider.sortBy === constants.ProfileSortMode.BySelfTime ? `${formatMilliseconds(this.node.selfTime)} (${this.node.selfPercent.toFixed(1)}%)` :
                this.provider.sortBy === constants.ProfileSortMode.ByTotalTime ? `${formatMilliseconds(this.node.totalTime)} (${this.node.totalPercent.toFixed(1)}%)` :
                `${formatMilliseconds(this.node.selfTime)} self, ${formatMilliseconds(this.node.totalTime)} total`
        });
    }

    private getIconPath() {
        if (this.node.entry instanceof DynamicFuncCodeEntry && this.node.entry.state === FunctionState.Inlined) {
            return new ThemeIcon("combine");
        }

        const functionEntry = this.provider.log?.findFunctionEntryByFunctionName(this.node.functionName);
        switch (functionEntry?.symbolKind) {
            case SymbolKind.Function: return new ThemeIcon("symbol-function");
            case SymbolKind.Class: return new ThemeIcon("symbol-class");
            case SymbolKind.Namespace: return new ThemeIcon("symbol-namespace");
            case SymbolKind.Enum: return new ThemeIcon("symbol-enum");
            case SymbolKind.Method: return new ThemeIcon("symbol-method");
            case SymbolKind.Property: return new ThemeIcon("symbol-property");
            case SymbolKind.Field: return new ThemeIcon("symbol-field");
            case SymbolKind.Constructor: return new ThemeIcon("symbol-constructor");
            default: return new ThemeIcon("symbol-misc");
        }
    }

    async onCommand(commandName: string) {
        if (commandName === constants.commands.profile.showLineTickDecorationsForNode) {
            const location = this.node.entry.filePosition ?? this.node.entry.functionName.filePosition;
            if (!location) return;
            const uri = getScriptSourceUri(location.uri, this.provider.log?.sources);
            if (!uri) return;
            setCurrentProfileViewNodeSnapshot(new ProfileViewNodeSnapshot(this.provider.log, this.node));
            await Promise.all([
                // show the "Line Ticks" tree view
                setShowLineTicks(true),

                // show line tick decorations
                setShowDecorations(showDecorations.add(constants.ShowDecorations.LineTicks)),

                // open the function in the editor
                window.showTextDocument(uri, { preview: true, selection: location.range }),
            ]);
            return;
        }
        return super.onCommand(commandName);
    }

    resolveTreeItem(item: TreeItem, token: CancellationToken) {
        if (item.tooltip !== undefined && item.command !== undefined) return;
        const { entry, functionName } = this.node;
        const location = entry.filePosition && entry.pickLocation(entry.filePosition.uri) || functionName.filePosition;
        if (item.tooltip === undefined) {
            const inlined = entry instanceof DynamicFuncCodeEntry && entry.state === FunctionState.Inlined;
            item.tooltip = markdown.trusted`${[
                entry.type === "CPP" ? markdown.trusted.code("cpp")`${functionName.name}` :
                entry.type === "SHARED_LIB" ? markdown.trusted.code`${functionName.name}` :
                markdown.trusted.code("javascript")`${functionName.name}`,
                markdown.trusted`---\n`,
                markdown.trusted`**Type:** ${entry.type}${inlined ? " (inlined)" : ""}  \n`,
                markdown.trusted`**Self time:** ${formatMilliseconds(this.node.selfTime)} (${this.node.selfPercent.toFixed(1)}%)  \n`,
                markdown.trusted`**Total time:** ${formatMilliseconds(this.node.totalTime)} (${this.node.totalPercent.toFixed(1)}%)  \n`,
                markdown.trusted`**Percent of parent:** ${this.node.parentTotalPercent.toFixed(1)}%  \n`,
                location ?
                    markdown.trusted`  \n${formatLocation(location, { as: "file" })}  \n` :
                    null,
                this.forNodes?.length ?
                    [
                        markdown.trusted`---\n`,
                        markdown.trusted`Hides:`,
                        this.forNodes.map(node => [
                            markdown.trusted`  \n`,
                            markdown.trusted`${node.functionName.name}  \n`,
                            markdown.trusted`${formatLocation(node.functionName.filePosition, { as: "file" })}  \n`
                        ])
                    ] :
                    null,
            ]}`;
        }
        if (item.command === undefined && location) {
            const uri = getScriptSourceUri(location.uri, this.provider.log?.sources);
            if (uri) {
                item.command = typeSafeCommand({
                    title: "open",
                    command: "vscode.open",
                    arguments: [uri, { preview: true, selection: location.range }]
                });
            }
        }
        return item;
    }

    protected getChildren(): Iterable<ProfileNode> {
        return this.provider.applySort(this.node.children);
    }
}
