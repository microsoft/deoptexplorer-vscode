// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ExtensionContext, Disposable } from "vscode";
import { activateScriptsFileSystemProvider } from "./scriptSourceFileSystemProvider";

export function activateFileSystemProviders(context: ExtensionContext) {
    return Disposable.from(
        activateScriptsFileSystemProvider(context),
    );
}
