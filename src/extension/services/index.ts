// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ExtensionContext, Disposable } from "vscode";
import { activateEventsService } from "./events";
import { activateCurrentLogFileService } from "./currentLogFile";
import { activateOperationManagerService } from "./operationManager";
import { activateContextService } from "./context";
import { activateStateManager } from "./stateManager";
import { activateCanonicalPaths } from "./canonicalPaths";
import { activateStorageService } from "./storage";

export async function activateCoreServices(context: ExtensionContext) {
    return Disposable.from(
        activateEventsService(context),
        activateOperationManagerService(context),
        activateStorageService(context), // NOTE: Storage service must come before context service.
        activateCurrentLogFileService(context),
        await activateContextService(context),
        activateStateManager(context),
        activateCanonicalPaths(context),
    );
}