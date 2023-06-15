// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable } from "@esfx/disposable";
import { from } from "@esfx/iter-query";
import { FunctionEntry } from "#deoptigate/functionEntry.js";
import { FunctionState, isCompiledFunctionState, isInterpretedFunctionState, isOptimizedFunctionState } from "#v8/enums/functionState.js";
import { ExtensionContext, OverviewRulerLane, TextEditorDecorationType, window } from "vscode";
import { ShowDecorations } from "../constants";
import { unwrapScriptSource } from "../fileSystemProviders/scriptSourceFileSystemProvider";
import { getCanonicalUri } from "../services/canonicalPaths";
import { showDecorations } from "../services/context";
import { openedLog } from "../services/currentLogFile";
import { events } from "../services/events";
import { VSDisposableStack } from "../vscode/disposable";
import { createBaseDecorationType, getTextEditors } from "./utils";

export class FunctionStateDecorations {
    private _showDecorations: "active" | "visible" | "none" = showDecorations.has(ShowDecorations.Functions) ? "visible" : "none";
    private _maxDecorations = 2_000;
    private _disposables: VSDisposableStack;
    private _compiledCodeDecorationType: TextEditorDecorationType;
    private _optimizableCodeDecorationType: TextEditorDecorationType;
    private _optimizedCodeDecorationType: TextEditorDecorationType;
    private _reoptimizedCodeDecorationType: TextEditorDecorationType;

    constructor() {
        const stack = new VSDisposableStack();
        try {
            this._compiledCodeDecorationType = stack.use(createBaseDecorationType("compiledCode", { isWholeLine: true, overviewRulerLane: OverviewRulerLane.Center, }));
            this._optimizableCodeDecorationType = stack.use(createBaseDecorationType("optimizableCode", { isWholeLine: true, overviewRulerLane: OverviewRulerLane.Center }));
            this._optimizedCodeDecorationType = stack.use(createBaseDecorationType("optimizedCode", { isWholeLine: true, overviewRulerLane: OverviewRulerLane.Center }));
            this._reoptimizedCodeDecorationType = stack.use(createBaseDecorationType("reoptimizedCode", { isWholeLine: true, overviewRulerLane: OverviewRulerLane.Center, }));
            stack.use(events.onDidOpenLogFile(() => this.update()));
            stack.use(events.onDidCloseLogFile(() => this._hide()));
            stack.use(events.onDidShowDecorationsChange(() => { this._onDidShowDecorationsChange(); }));
            stack.use(window.onDidChangeActiveTextEditor(() => this.update()));
            stack.use(window.onDidChangeVisibleTextEditors(() => this.update()));
            stack.use(() => { this._hide(); });
            this._show();
            this._disposables = stack.move();
        }
        finally {
            stack.dispose();
        }
    }

    get showDecorations() { return this._showDecorations; }
    set showDecorations(value) {
        if (this._showDecorations !== value) {
            this._hide();
            this._showDecorations = value;
            if (this._showDecorations !== "none") {
                this._show();
            }
        }
    }

    private _onDidShowDecorationsChange() {
        this.showDecorations = showDecorations.has(ShowDecorations.Functions) ? "visible" : "none";
    }

    private _hide() {
        for (const editor of getTextEditors(this._showDecorations)) {
            editor.setDecorations(this._reoptimizedCodeDecorationType, []);
            editor.setDecorations(this._compiledCodeDecorationType, []);
            editor.setDecorations(this._optimizableCodeDecorationType, []);
            editor.setDecorations(this._optimizedCodeDecorationType, []);
        }
    }

    private _show() {
        if (!openedLog) return;
        for (const editor of getTextEditors(this._showDecorations)) {
            const uri = unwrapScriptSource(editor.document.uri).uri;
            if (!uri) continue;

            const fileUri = getCanonicalUri(uri);
            const entries = openedLog.files.get(fileUri);
            const functions = entries?.functions;
            if (!functions?.length) return;

            if (functions.length > this._maxDecorations) {
                window.showWarningMessage(`There are too many functions in this file. Only the first ${this._maxDecorations} function states will be shown.`);
            }

            const decorations =
                from(functions)
                .take(this._maxDecorations)
                .select(func => ({ func, type: this.getDecorationForFunction(func) }))
                .select(({ func, type }) => type ? ({ func, type }) : undefined).filterDefined()
                .select(({ func, type }) => ({ type, range: func.pickExtentLocation(fileUri)?.range }))
                .select(({ type, range }) => range ? ({ type, range }) : undefined).filterDefined()
                .groupBy(({ type }) => type, ({ range }) => range, (type, ranges) => ({ type, ranges: ranges.toArray() }));

            for (const { type, ranges } of decorations) {
                editor.setDecorations(type, ranges);
            }
        }
    }

    private getDecorationForFunction(entry: FunctionEntry): TextEditorDecorationType | undefined {
        let last = FunctionState.Compiled;
        let optimizedCount = 0;
        for (let i = 0; i < entry.updates.length; i++) {
            const update = entry.updates[i];
            last = update.state;
            if (isOptimizedFunctionState(last)) {
                optimizedCount++;
            }
        }
        if (isCompiledFunctionState(last)) return this._compiledCodeDecorationType;
        if (isInterpretedFunctionState(last)) return this._optimizableCodeDecorationType;
        if (isOptimizedFunctionState(last)) return optimizedCount > 1 ? this._reoptimizedCodeDecorationType : this._optimizedCodeDecorationType;
    }

    update() {
        this._hide();
        this._show();
    }

    [Disposable.dispose]() {
        this._disposables.dispose();
    }
}

export function activateFunctionStateDecorations(context: ExtensionContext) {
    const stack = new VSDisposableStack();
    stack.use(new FunctionStateDecorations());
    return stack;
}
