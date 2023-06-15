// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable } from "@esfx/disposable";
import * as fn from "@esfx/fn";
import { from } from "@esfx/iter-query";
import { DeoptimizeKind } from "#v8/enums/deoptimizeKind.js";
import { ExtensionContext, TextEditorDecorationType, window } from "vscode";
import { ShowDecorations } from "../constants";
import { unwrapScriptSource } from "../fileSystemProviders/scriptSourceFileSystemProvider";
import { getCanonicalUri } from "../services/canonicalPaths";
import { showDecorations } from "../services/context";
import { openedLog } from "../services/currentLogFile";
import { events } from "../services/events";
import { VSDisposableStack } from "../vscode/disposable";
import { createDecorationType, getTextEditors } from "./utils";

export class DeoptDecorations {
    private _showDecorations: "active" | "visible" | "none" = showDecorations.has(ShowDecorations.Deopts) ? "visible" : "none";
    private _maxDecorations = 2_000;
    private _disposables: VSDisposableStack;
    private _eagerDeoptDecorationType: TextEditorDecorationType;
    private _lazyDeoptDecorationType: TextEditorDecorationType;
    private _softDeoptDecorationType: TextEditorDecorationType;

    constructor() {
        const stack = new VSDisposableStack();
        try {
            this._eagerDeoptDecorationType = stack.use(createDecorationType("eagerDeopt"));
            this._lazyDeoptDecorationType = stack.use(createDecorationType("lazyDeopt"));
            this._softDeoptDecorationType = stack.use(createDecorationType("softDeopt"));
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
        this.showDecorations = showDecorations.has(ShowDecorations.Deopts) ? "visible" : "none";
    }

    private _hide() {
        for (const editor of getTextEditors(this._showDecorations)) {
            editor.setDecorations(this._eagerDeoptDecorationType, []);
            editor.setDecorations(this._lazyDeoptDecorationType, []);
            editor.setDecorations(this._softDeoptDecorationType, []);
        }
    }

    private _show() {
        if (!openedLog) return;
        for (const editor of getTextEditors(this._showDecorations)) {
            const uri = unwrapScriptSource(editor.document.uri).uri;
            if (!uri) continue;

            const fileUri = getCanonicalUri(uri);
            const entries = openedLog.files.get(fileUri);
            const deopts = entries?.deopts;
            if (!deopts?.length) return;

            if (deopts.length > this._maxDecorations) {
                window.showWarningMessage(`There are too many deoptimizations in this file. Only the first ${this._maxDecorations} deoptimizations will be shown.`);
            }

            const decorations =
                from(deopts)
                .take(this._maxDecorations)
                .select(deopt => ({ deopt, worst: from(deopt.updates).maxBy(fn.property("bailoutType"))}))
                .select(({ deopt, worst }) => worst ? ({ deopt, worst }) : undefined).filterDefined()
                .select(({ deopt, worst }) => ({ deopt, worst, type: this.getDecorationForBailoutType(worst.bailoutType) }))
                .select(({ deopt, worst, type }) => type ? ({ deopt, worst, type }) : undefined).filterDefined()
                .select(({ deopt, worst, type }) => ({ deopt, worst, type, range: deopt.pickReferenceLocation(fileUri)?.range }))
                .select(({ deopt, worst, type, range }) => range ? ({ deopt, worst, type, range }) : undefined).filterDefined()
                .groupBy(({ type }) => type, ({ range }) => range, (type, ranges) => ({ type, ranges: ranges.toArray() }));

            for (const { type, ranges } of decorations) {
                editor.setDecorations(type, ranges);
            }
        }
    }

    private getDecorationForBailoutType(type: DeoptimizeKind): TextEditorDecorationType | undefined {
        switch (type) {
            case DeoptimizeKind.Eager: return this._eagerDeoptDecorationType;
            case DeoptimizeKind.Lazy: return this._lazyDeoptDecorationType;
            case DeoptimizeKind.Soft: return this._softDeoptDecorationType;
        }
    }

    update() {
        this._hide();
        this._show();
    }

    [Disposable.dispose]() {
        this._disposables.dispose();
    }
}

export function activateDeoptDecorations(context: ExtensionContext) {
    const stack = new VSDisposableStack();
    stack.use(new DeoptDecorations());
    return stack;
}
