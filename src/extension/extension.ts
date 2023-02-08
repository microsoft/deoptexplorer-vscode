// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import "source-map-support/register";
import { ExtensionContext } from "vscode";
import { activateWin32 } from "../platforms/win32";
import { activateCommands } from "./commands";
import { activateDecorations } from "./decorations";
import { activateHoverProviders } from "./hoverProviders";
import { activateOutputChannel } from "./outputChannel";
import { activateCoreServices } from "./services";
import { activateTextDocumentContentProviders } from "./textDocumentContentProviders";
import { activateTreeViews } from "./treeViews";
import { activateWebviews } from "./webviewViews";

export async function activate(context: ExtensionContext) {
    // 'dbghelp' should only be loaded on Windows platforms
    if (process.platform === "win32") {
        context.subscriptions.push(await activateWin32(context));
    }

    try {
        context.subscriptions.push(
            await activateCoreServices(context),
            activateOutputChannel(context),
            activateCommands(context),
            activateDecorations(context),
            activateHoverProviders(context),
            await activateTreeViews(context),
            activateTextDocumentContentProviders(context),
            activateWebviews(context),
        );
    }
    catch (e) {
        console.error(e);
        debugger;
        throw e;
    }
}