// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import { FunctionEntry } from "#deoptigate/functionEntry.js";
import { FunctionState, isOptimizedFunctionState } from "#v8/enums/functionState.js";
import { SymbolKind, ThemeIcon, TreeItemCollapsibleState, Uri } from "vscode";
import { getScriptSourceUri } from "../../fileSystemProviders/scriptSourceFileSystemProvider";
import { FunctionReference } from "../../model/functionReference";
import { TypeSafeCommand } from "../../vscode/commands";
import { formatLocation } from "../../vscode/location";
import { BaseNode } from "../common/baseNode";
import { createTreeItem } from "../createTreeItem";
import { FunctionsTreeDataProvider } from "./functionTreeDataProvider";

export class FunctionNode extends BaseNode {
    private _functionReference: FunctionReference | null | undefined;
    private _file: Uri | undefined;
    private _state: FunctionState | -1 | undefined;

    constructor(
        provider: FunctionsTreeDataProvider,
        parent: BaseNode | undefined,
        readonly func: FunctionEntry,
    ) {
        super(provider, parent);
    }

    get provider(): FunctionsTreeDataProvider { return super.provider as FunctionsTreeDataProvider; }
    get file() { return this._file ??= this.func.filePosition.uri; }
    get functionReference() { return this._functionReference ??= FunctionReference.fromFunctionEntry(this.func) ;}
    get state() { return this._state ??= from(this.func.updates).count(update => isOptimizedFunctionState(update.state)) > 1 ? -1 : from(this.func.updates).last()?.state ?? FunctionState.Compiled }

    protected formatLabel() {
        // For a function, the label is the name and the number of updates to the function.
        return `${this.func.functionName} (${this.func.updates.length})`;
    }

    private getIconPath() {
        switch (this.func?.symbolKind) {
            case SymbolKind.Function: return new ThemeIcon("symbol-function");
            case SymbolKind.Class: return new ThemeIcon("symbol-class");
            case SymbolKind.Namespace: return new ThemeIcon("symbol-namespace");
            case SymbolKind.Enum: return new ThemeIcon("symbol-enum");
            case SymbolKind.Method: return new ThemeIcon("symbol-method");
            case SymbolKind.Property: return new ThemeIcon("symbol-property");
            case SymbolKind.Field: return new ThemeIcon("symbol-field");
            case SymbolKind.Constructor: return new ThemeIcon("symbol-constructor");
        }
    }

    private getCommand(): TypeSafeCommand | undefined {
        if (!this.functionReference?.location) return undefined;
        const uri = getScriptSourceUri(this.functionReference.location.uri, this.provider.log?.sources);
        return uri && {
            title: "Go to Function",
            command: "vscode.open",
            arguments: [
                uri,
                {
                    preview: true,
                    selection: this.functionReference.location.range
                }
            ]
        };
    }

    protected override createTreeItem() {
        const label = this.formatLabel();
        const relativeTo = this.provider.log && { log: this.provider.log, ignoreIfBasename: true };
        const description = formatLocation(this.func.referenceLocation, { as: "file", skipEncoding: true, relativeTo });

        return createTreeItem(label, TreeItemCollapsibleState.None, {
            description: description,
            iconPath: this.getIconPath(),
            contextValue: "",
            command: this.getCommand(),
        });
    }
}
