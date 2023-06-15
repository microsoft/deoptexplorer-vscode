// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable } from "@esfx/disposable";
import * as fn from "@esfx/fn";
import { from } from "@esfx/iter-query";
import { IcState } from "#v8/enums/icState.js";
import { ExtensionContext, TextEditorDecorationType, window } from "vscode";
import { ShowDecorations } from "../constants";
import { unwrapScriptSource } from "../fileSystemProviders/scriptSourceFileSystemProvider";
import { getCanonicalUri } from "../services/canonicalPaths";
import { showDecorations } from "../services/context";
import { openedLog } from "../services/currentLogFile";
import { events } from "../services/events";
import { VSDisposableStack } from "../vscode/disposable";
import { createDecorationType, getTextEditors } from "./utils";

export class ICDecorations {
    private _showDecorations: "active" | "visible" | "none" = showDecorations.has(ShowDecorations.ICs) ? "visible" : "none";
    private _maxDecorations = 10_000;
    private _disposables: VSDisposableStack;
    private _noFeedbackIcDecorationType: TextEditorDecorationType;
    private _uninitializedIcDecorationType: TextEditorDecorationType;
    private _monomorphicIcDecorationType: TextEditorDecorationType;
    private _premonomorphicIcDecorationType: TextEditorDecorationType;
    private _polymorphicIcDecorationType: TextEditorDecorationType;
    private _recomputeHandlerIcDecorationType: TextEditorDecorationType;
    private _megamorphicIcDecorationType: TextEditorDecorationType;
    private _genericIcDecorationType: TextEditorDecorationType;

    constructor() {
        const stack = new VSDisposableStack();
        try {
            this._noFeedbackIcDecorationType = stack.use(createDecorationType("noFeedbackIc"));
            this._uninitializedIcDecorationType = stack.use(createDecorationType("uninitializedIc"));
            this._premonomorphicIcDecorationType = stack.use(createDecorationType("premonomorphicIc"));
            this._monomorphicIcDecorationType = stack.use(createDecorationType("monomorphicIc"));
            this._polymorphicIcDecorationType = stack.use(createDecorationType("polymorphicIc"));
            this._recomputeHandlerIcDecorationType = stack.use(createDecorationType("recomputeHandlerIc"));
            this._megamorphicIcDecorationType = stack.use(createDecorationType("megamorphicIc"));
            this._genericIcDecorationType = stack.use(createDecorationType("genericIc"));
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
        this.showDecorations = showDecorations.has(ShowDecorations.ICs) ? "visible" : "none";
    }

    private _hide() {
        for (const editor of getTextEditors(this._showDecorations)) {
            editor.setDecorations(this._noFeedbackIcDecorationType, []);
            editor.setDecorations(this._uninitializedIcDecorationType, []);
            editor.setDecorations(this._premonomorphicIcDecorationType, []);
            editor.setDecorations(this._monomorphicIcDecorationType, []);
            editor.setDecorations(this._polymorphicIcDecorationType, []);
            editor.setDecorations(this._recomputeHandlerIcDecorationType, []);
            editor.setDecorations(this._megamorphicIcDecorationType, []);
            editor.setDecorations(this._genericIcDecorationType, []);
        }
    }

    private _show() {
        if (!openedLog) return;
        for (const editor of getTextEditors(this._showDecorations)) {
            const uri = unwrapScriptSource(editor.document.uri).uri;
            if (!uri) continue;

            const fileUri = getCanonicalUri(uri);
            const entries = openedLog.files.get(fileUri);
            const ics = entries?.ics;
            if (!ics?.length) return;

            if (ics.length > this._maxDecorations) {
                window.showWarningMessage(`There are too many ICs in this file. Only the first ${this._maxDecorations} ICs will be shown.`);
            }

            const decorations =
                from(ics)
                .select(ic => ({ ic, worst: from(ic.updates).maxBy(fn.property("newState")) }))
                .select(({ ic, worst }) => worst ? ({ ic, worst }) : undefined).filterDefined()
                .orderByDescending(({ worst }) => worst.newState)
                .take(this._maxDecorations)
                .select(({ ic, worst }) => ({ ic, worst, type: this.getDecorationForIcState(worst.newState) }))
                .select(({ ic, worst, type }) => type ? ({ ic, worst, type }) : undefined).filterDefined()
                .select(({ ic, worst, type }) => ({ ic, worst, type, range: ic.pickReferenceLocation(fileUri)?.range }))
                .select(({ ic, worst, type, range }) => range ? ({ ic, worst, type, range }) : undefined).filterDefined()
                .groupBy(({ type }) => type, ({ range }) => range, (type, ranges) => ({ type, ranges: ranges.toArray() }));

            for (const { type, ranges } of decorations) {
                editor.setDecorations(type, ranges);
            }
        }
    }

    private getDecorationForIcState(state: IcState): TextEditorDecorationType | undefined {
        switch (state) {
            case IcState.NO_FEEDBACK: return this._noFeedbackIcDecorationType;
            case IcState.UNINITIALIZED: return this._uninitializedIcDecorationType;
            case IcState.PREMONOMORPHIC: return this._premonomorphicIcDecorationType;
            case IcState.MONOMORPHIC: return this._monomorphicIcDecorationType;
            case IcState.RECOMPUTE_HANDLER: return this._recomputeHandlerIcDecorationType;
            case IcState.POLYMORPHIC: return this._polymorphicIcDecorationType;
            case IcState.MEGAMORPHIC: return this._megamorphicIcDecorationType;
            case IcState.GENERIC: return this._genericIcDecorationType;
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

export function activateICDecorations(context: ExtensionContext) {
    const stack = new VSDisposableStack();
    stack.use(new ICDecorations());
    return stack;
}
