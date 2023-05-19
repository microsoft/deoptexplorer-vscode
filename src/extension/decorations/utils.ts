// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { MatchingKeys } from "@esfx/type-model";
import { DecorationRenderOptions, OverviewRulerLane, TextEditor, window } from "vscode";
import * as constants from "../constants";

export type DecorationKeys = MatchingKeys<typeof constants.colors, { background: string }>;

export function createBaseDecorationType(key: DecorationKeys, options?: DecorationRenderOptions) {
    return window.createTextEditorDecorationType({
        backgroundColor: { id: constants.colors[key].background },
        overviewRulerColor: { id: constants.colors[key].overviewRuler },
        overviewRulerLane: OverviewRulerLane.Left,
        ...options
    });
}

export function createDecorationType(key: DecorationKeys, options?: DecorationRenderOptions) {
    return createBaseDecorationType(key, {
        borderStyle: "solid",
        borderWidth: "1px",
        borderRadius: "2px",
        borderColor: { id: constants.colors[key].border },
        ...options
    });
}

export function getAllTextEditors() {
    return getTextEditors("visible");
}

export function getTextEditors(kind: "visible" | "active" | "none") {
    const editors = new Set<TextEditor>(kind === "visible" ? window.visibleTextEditors : undefined);
    if (kind === "active" && window.activeTextEditor) editors.add(window.activeTextEditor);
    return [...editors].filter(editor => editor.document.uri.scheme !== "output");
}
