// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import "source-map-support/register";
import { ExtensionContext } from "vscode";
import { activateCommands } from "./commands";
import { activateDecorations } from "./decorations";
import { activateFileSystemProviders } from "./fileSystemProviders";
import { activateHoverProviders } from "./hoverProviders";
import { activateOutputChannel } from "./outputChannel";
import { activateCoreServices } from "./services";
import { activateTextDocumentContentProviders } from "./textDocumentContentProviders";
import { activateTreeViews } from "./treeViews";
import { activateWebviews } from "./webviewViews";

export async function activate(context: ExtensionContext) {
    try {
        context.subscriptions.push(
            await activateCoreServices(context),
            activateOutputChannel(context),
            activateCommands(context),
            activateDecorations(context),
            activateHoverProviders(context),
            await activateTreeViews(context),
            activateTextDocumentContentProviders(context),
            activateFileSystemProviders(context),
            activateWebviews(context)
        );
    }
    catch (e) {
        console.error(e);
        debugger;
        throw e;
    }
}