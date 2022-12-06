// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { TextDocument, TextEditor, Uri } from "vscode";
import * as constants from "./constants";
import { isIgnoredFile } from "./services/canonicalPaths";

export function isSupportedLanguage(languageId: string) {
    return constants.supportedLanguages.includes(languageId);
}

export function isSupportedScheme(scheme: string) {
    return scheme === "file";
}

export function isSupportedFile(file: string) {
    return !isIgnoredFile(file);
}

export function isSupportedUri(uri: Uri) {
    return isSupportedScheme(uri.scheme)
        && isSupportedFile(uri.fsPath);
}

export function isSupportedDocument(document: TextDocument) {
    return isSupportedLanguage(document.languageId)
        && isSupportedScheme(document.uri.scheme)
        && isSupportedFile(document.uri.fsPath);
}

export function isSupportedEditor(editor: TextEditor) {
    return isSupportedDocument(editor.document);
}
