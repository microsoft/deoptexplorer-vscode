// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ExtensionContext, Disposable } from "vscode";
import { activateMapTextDocumentContentProvider } from "./map";

export function activateTextDocumentContentProviders(context: ExtensionContext) {
    return Disposable.from(
        activateMapTextDocumentContentProvider(context),
    );
}
