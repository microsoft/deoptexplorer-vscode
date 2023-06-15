// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { uriBasename } from "#core/uri.js";
import type { FunctionEntry } from "#deoptigate/functionEntry.js";
import { SymbolKind, ThemeIcon, Uri } from "vscode";
import { formatPosition } from "../../../vscode/position";
import { EntryNode } from "../common/entryNode";
import type { FunctionGroupNode } from "./functionGroupNode";

/**
 * Represents a function.
 */
export class FunctionEntryNode extends EntryNode<FunctionEntry> {
    constructor(parent: FunctionGroupNode, entry: FunctionEntry) {
        super(parent, entry);
    }

    /**
     * Gets the conceptual parent of this node.
     */
    get parent(): FunctionGroupNode { return super.parent as FunctionGroupNode; }

    protected formatLabel() {
        // For a function, the label is the name and the number of updates to the function.
        return `${this.entry.functionName} (${this.entry.updates.length})`;
    }

    protected formatDescription() {
        // For a function, the description is the base filename and its line/character offset.
        const { range } = this.entry.pickExtentLocation(this.file);
        return `${uriBasename(this.file)}${formatPosition(range.start)}`;
    }

    protected override iconPath(): string | Uri | { light: string | Uri; dark: string | Uri } | ThemeIcon | undefined {
        switch (this.entry.symbolKind) {
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

    protected recordEntry() {
        this.provider.functionNodes.set(this.entry, this);
    }
}
