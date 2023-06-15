// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { deserialize, serialize } from "#core/serializer.js";
import * as vscode from "vscode";
import { AsCommandArgumentValue } from "../types";

interface EditorGroupLayout {
    orientation?: 0 | 1;
    groups: EditorGroupArgument[];
}

interface EditorGroupArgument {
    size?: number;
    groups?: EditorGroupArgument[];
}

declare global {
    interface KnownTypes {
        // Register EditorGroupLayout as its definition is recursive and cannot be checked with `AsCommandArgumentValue`.
        EditorGroupLayout: EditorGroupLayout;
    }

    // Known commands registry. Augment this interface to register a known command
    interface KnownCommands {
        "vscode.diff": (left: vscode.Uri, right: vscode.Uri, title?: string, columnOrOptions?: vscode.ViewColumn | vscode.TextDocumentShowOptions) => void;
        "vscode.executeCodeActionProvider": (uri: vscode.Uri, rangeOrSelection: vscode.Range | vscode.Selection, kind?: string, itemResolveCount?: number) => (vscode.CodeAction | vscode.Command | undefined)[] | undefined;
        "vscode.executeCodeLensProvider": (uri: vscode.Uri, itemResolveCount?: number) => vscode.CodeLens[] | undefined;
        "vscode.executeColorPresentationProvider": (color: vscode.Color, context: { uri: vscode.Uri, range: vscode.Range }) => vscode.ColorPresentation[];
        "vscode.executeCompletionItemProvider": (uri: vscode.Uri, position: vscode.Position, triggerCharacter?: string, itemResolveCount?: number) => vscode.CompletionList;
        "vscode.executeDeclarationProvider": (uri: vscode.Uri, position: vscode.Position) => (vscode.Location | vscode.LocationLink)[];
        "vscode.executeDefinitionProvider": (uri: vscode.Uri, position: vscode.Position) => (vscode.Location | vscode.LocationLink)[];
        "vscode.executeDocumentColorProvider": (uri: vscode.Uri) => vscode.ColorInformation[];
        "vscode.executeDocumentHighlights": (uri: vscode.Uri, position: vscode.Position) => (vscode.SymbolInformation | vscode.DocumentSymbol)[];
        "vscode.executeDocumentRenameProvider": (uri: vscode.Uri, position: vscode.Position, newName: string) => vscode.WorkspaceEdit;
        "vscode.executeDocumentSymbolProvider": (uri: vscode.Uri) => vscode.DocumentHighlight[];
        "vscode.executeFormatDocumentProvider": (uri: vscode.Uri, options: vscode.FormattingOptions) => vscode.TextEdit[];
        "vscode.executeFormatOnTypeProvider": (uri: vscode.Uri, position: vscode.Position, ch: string, options: vscode.FormattingOptions) => vscode.TextEdit[];
        "vscode.executeFormatRangeProvider": (uri: vscode.Uri, range: vscode.Range, options: vscode.FormattingOptions) => vscode.TextEdit[];
        "vscode.executeHoverProvider": (uri: vscode.Uri, position: vscode.Position) => vscode.Hover[];
        "vscode.executeImplementationProvider": (uri: vscode.Uri, position: vscode.Position) => (vscode.Location | vscode.LocationLink)[];
        "vscode.executeLinkProvider": (uri: vscode.Uri, linkResolveCount?: number) => vscode.DocumentLink[];
        "vscode.executeReferenceProvider": (uri: vscode.Uri, position: vscode.Position) => vscode.Location[];
        "vscode.executeSelectionRangeProvider": (uri: vscode.Uri, position: vscode.Position) => vscode.Range[];
        "vscode.executeSignatureHelpProvider": (uri: vscode.Uri, position: vscode.Position, triggerCharacter?: string) => vscode.SignatureHelp | undefined;
        "vscode.executeTypeDefinitionProvider": (uri: vscode.Uri, position: vscode.Position) => (vscode.Location | vscode.LocationLink)[];
        "vscode.executeWorkspaceSymbolProvider": (query: string) => vscode.SymbolInformation[];
        "vscode.open": (uri: vscode.Uri, columnOrOptions?: vscode.ViewColumn | vscode.TextDocumentShowOptions, label?: string) => void;
        "vscode.openFolder": (uri?: vscode.Uri, options?: { forceNewWindow?: boolean; noRecentEntry?: boolean; } | boolean) => void;
        "vscode.openIssueReporter": (extensionId: string | { extensionId: string, issueTitle?: string, issueBody?: string }) => void;
        "vscode.openWith": (resource: vscode.Uri, viewId: string, columnOrOptions?: vscode.ViewColumn | vscode.TextDocumentShowOptions) => void;
        "vscode.prepareCallHierarchy": (uri: vscode.Uri, position: vscode.Position) => vscode.CallHierarchyItem | undefined;
        "vscode.provideDocumentRangeSemanticTokens": (uri: vscode.Uri, range: vscode.Range) => vscode.SemanticTokens | undefined;
        "vscode.provideDocumentRangeSemanticTokensLegend": (uri: vscode.Uri) => vscode.SemanticTokensLegend | undefined;
        "vscode.provideDocumentSemanticTokens": (uri: vscode.Uri) => vscode.SemanticTokens | undefined;
        "vscode.provideDocumentSemanticTokensLegend": (uri: vscode.Uri) => vscode.SemanticTokensLegend | undefined;
        "vscode.provideIncomingCalls": (item: vscode.CallHierarchyItem) => vscode.CallHierarchyIncomingCall | undefined;
        "vscode.provideOutgoingCalls": (item: vscode.CallHierarchyItem) => vscode.CallHierarchyOutgoingCall | undefined;
        "vscode.removeFromRecentlyOpened": (path: string) => void;
        "vscode.setEditorLayout": (layout: EditorGroupLayout) => void;
        "workbench.action.files.newUntitledFile": (viewType: string) => void;
        "workbench.action.findInFiles": (args: { query?: string, replace?: string, preserveCase?: boolean, triggerSearch?: boolean, filesToInclude?: string, filesToExclude?: string, isRegex?: boolean, isCaseSensitive?: boolean, matchWholeWord?: boolean, useExcludeSettingsAndIgnoreFiles?: boolean }) => void;
        "workbench.action.quickOpen": (prefix?: string) => void;
        "workbench.extensions.installExtension": (arg: string | vscode.Uri) => void;
        "workbench.extensions.search": (query: string) => void;
        "workbench.extensions.uninstallExtension": (id: string) => void;
        "editor.action.goToLocations": (uri: vscode.Uri, position: vscode.Position, locations: vscode.Location[], multiple?: "peek" | "gotoAndPeek" | "goto", noResultsMessage?: string) => void;
        "editor.action.peekLocations": (uri: vscode.Uri, position: vscode.Position, locations: vscode.Location[], multiple?: "peek" | "gotoAndPeek" | "goto") => void;
        "editor.action.showReferences": (uri: vscode.Uri, position: vscode.Position, references: readonly vscode.Location[]) => void;
        "editor.fold": (args: { levels?: number; direction?: "up" | "down"; selectionLines?: number[]; }) => void;
        "editor.unfold": (args: { levels?: number; direction?: "up" | "down"; selectionLines?: number[]; }) => void;
        "search.action.openEditor": (args: { query?: string; filesToInclude?: string, filesToExclude?: string, contextLines?: number, matchWholeWord?: boolean, isCaseSensitive?: boolean, isRegexp?: boolean, useExcludeSettingsAndIgnoreFiles?: boolean, showIncludesExcludes?: boolean, triggerSearch?: boolean, focusResults?: boolean }) => void;
        "search.action.openNewEditor": (args: { query?: string; filesToInclude?: string, filesToExclude?: string, contextLines?: number, matchWholeWord?: boolean, isCaseSensitive?: boolean, isRegexp?: boolean, useExcludeSettingsAndIgnoreFiles?: boolean, showIncludesExcludes?: boolean, triggerSearch?: boolean, focusResults?: boolean }) => void;
        "search.action.openNewEditorToSide": (args: { query?: string; filesToInclude?: string, filesToExclude?: string, contextLines?: number, matchWholeWord?: boolean, isCaseSensitive?: boolean, isRegexp?: boolean, useExcludeSettingsAndIgnoreFiles?: boolean, showIncludesExcludes?: boolean, triggerSearch?: boolean, focusResults?: boolean }) => void;
        "setContext": (key: string, value: unknown) => void;
        "cursorMove": (args: { to: "left" | "right" | "up" | "down" | "wrappedLineStart" | "wrappedLineEnd" | "wrappedLineColumnCenter" | "wrappedLineFirstNonWhitespaceCharacter" | "wrappedLineLastNonWhitespaceCharacter" | "viewPortTop" | "viewPortCenter" | "viewPortBottom" | "viewPortIfOutside"; by?: "line" | "wrappedLine" | "character" | "halfLine"; value?: number; select?: boolean; }) => void;
        "editorScroll": (args: { to: "up" | "down"; by?: "line" | "wrappedLine" | "page" | "halfPage"; value?: number; revealCursor?: boolean }) => void;
        "moveActiveEditor": (args: { to: "left" | "right", by?: "tab" | "group", value?: number }) => void;
        "revealLine": (args: { lineNumber: number, at?: "top" | "center" | "bottom" }) => void;

        "workbench.extensions.action.showExtensionsWithIds": (extensionIds: string[]) => void;
    }
}

// #region Type checking for `KnownCommands`

// Type check the `KnownCommands` interface without introducing a string index signature...
type ValidKnownCommands<T> = {
    [P in Extract<keyof T, string>]: T[P] extends (...args: any) => any ?
    (...args: MapCommandParameters<Parameters<T[P]>>) => any :
        never
};

type MapCommandParameters<A extends any[]> = Extract<{ [P in keyof A]: P extends `${number}` ? AsCommandArgumentValue<A[P]> : A[P] }, any[]>;

type ValidKnownCommands2<T extends KnownCommands> = {
    [P in Extract<keyof T, KnownCommandNames>]: (...args: MapCommandParameters<KnownCommandParameters<P>>) => any;
};

type CheckKnownCommands<
    T extends ValidKnownCommands<KnownCommands> = KnownCommands,
    T2 extends ValidKnownCommands2<KnownCommands> = KnownCommands,
    K extends string = keyof KnownCommands
> = [T, T2, K, typeof kUnusedKnownCommandsAreValid];

declare const kUnusedKnownCommandsAreValid: CheckKnownCommands;

// #endregion Type checking for `KnownCommands`

export type KnownCommandNames = Extract<keyof KnownCommands, string>;
export type KnownCommandParameters<K extends KnownCommandNames> = Parameters<Extract<KnownCommands[K], (...args: any) => any>>;
export type KnownCommandReturnType<K extends KnownCommandNames> = Thenable<ReturnType<Extract<KnownCommands[K], (...args: any) => any>>>;
export type KnownCommandProviderResult<K extends KnownCommandNames> = Thenable<ReturnType<Extract<KnownCommands[K], (...args: any) => any>>> | ReturnType<Extract<KnownCommands[K], (...args: any) => any>>;

export type TypeSafeCommand<K extends KnownCommandNames = KnownCommandNames> = K extends KnownCommandNames ? ({
    title: string;
    command: K;
    tooltip?: string;
} & (KnownCommands[K] extends [] ? { arguments?: [] } :
    [] extends KnownCommands[K] ? { arguments?: KnownCommandParameters<K> } :
    { arguments: KnownCommandParameters<K> })) : never;

/**
 * Registers a command that can be invoked via a keyboard shortcut,
 * a menu item, an action, or directly.
 *
 * Registering a command with an existing command identifier twice
 * will cause an error.
 *
 * @param command A unique identifier for the command.
 * @param callback A command handler function.
 * @param thisArg The `this` context used when invoking the handler function.
 * @return Disposable which unregisters this command on disposal.
 */
export function typeSafeRegisterCommand<K extends KnownCommandNames, T>(command: K, callback: (this: T, ...args: KnownCommandParameters<K>) => KnownCommandProviderResult<K>, thisArg: T): vscode.Disposable;
/**
 * Registers a command that can be invoked via a keyboard shortcut,
 * a menu item, an action, or directly.
 *
 * Registering a command with an existing command identifier twice
 * will cause an error.
 *
 * @param command A unique identifier for the command.
 * @param callback A command handler function.
 * @param thisArg The `this` context used when invoking the handler function.
 * @return Disposable which unregisters this command on disposal.
 */
export function typeSafeRegisterCommand<K extends KnownCommandNames>(command: K, callback: (...args: KnownCommandParameters<K>) => KnownCommandProviderResult<K>, thisArg?: any): vscode.Disposable;
export function typeSafeRegisterCommand<K extends KnownCommandNames>(command: K, callback: (...args: KnownCommandParameters<K>) => KnownCommandProviderResult<K>, thisArg?: any): vscode.Disposable {
    return vscode.commands.registerCommand(command, (...args: any[]) => callback.apply(thisArg, args.map(deserializeArg) as any));
}

/**
 * Executes the command denoted by the given command identifier.
 *
 * * *Note 1:* When executing an editor command not all types are allowed to
 * be passed as arguments. Allowed are the primitive types `string`, `boolean`,
 * `number`, `undefined`, and `null`, as well as [`Position`](#Position), [`Range`](#Range), [`Uri`](#Uri) and [`Location`](#Location).
 * * *Note 2:* There are no restrictions when executing commands that have been contributed
 * by extensions.
 *
 * @param command Identifier of the command to execute.
 * @param rest Parameters passed to the command function.
 * @return A thenable that resolves to the returned value of the given command. `undefined` when
 * the command handler function doesn't return anything.
 */
export function typeSafeExecuteCommand<K extends KnownCommandNames>(commandName: K, ...rest: KnownCommandParameters<K>): KnownCommandReturnType<K> {
    return vscode.commands.executeCommand<any>(commandName, ...rest.map(serializeArg));
}

/**
 * Identity function that ensures a command matches the type and arguments of a known command.
 */
export function typeSafeCommand<K extends KnownCommandNames>(command: TypeSafeCommand<K>) {
    return command;
}

function serializeArg(arg: any) {
    return serialize(arg, /*serializers*/ undefined, /*ignoreBuiltins*/ true);
}

function deserializeArg(arg: any) {
    return deserialize(arg, /*serializers*/ undefined);
}
