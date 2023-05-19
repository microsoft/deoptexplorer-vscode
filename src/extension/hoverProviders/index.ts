// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ExtensionContext, languages } from "vscode";
import { supportedLanguages } from "../constants";
import { events } from "../services/events";
import { VSDisposableStack } from "../vscode/disposable";
import { DeoptHoverProvider } from "./deoptHoverProvider";
import { FunctionStateHoverProvider } from "./functionStateHoverProvider";
import { ICHoverProvider } from "./icHoverProvider";
import * as constants from "../constants";

export function activateHoverProviders(context: ExtensionContext) {
    const disposables = new VSDisposableStack();
    const icProvider = disposables.use(new ICHoverProvider());
    const deoptProvider = disposables.use(new DeoptHoverProvider());
    const functionStateProvider = disposables.use(new FunctionStateHoverProvider());
    const resetCache = () => {
        icProvider.resetCache();
        deoptProvider.resetCache();
        functionStateProvider.resetCache();
    };
    const selectors = supportedLanguages.flatMap(language => [{ scheme: "file", language }, { scheme: constants.schemes.source }]);
    disposables.use(languages.registerHoverProvider(selectors, icProvider));
    disposables.use(languages.registerHoverProvider(selectors, deoptProvider));
    disposables.use(languages.registerHoverProvider(selectors, functionStateProvider));
    disposables.use(events.onDidOpenLogFile(resetCache));
    disposables.use(events.onDidCloseLogFile(resetCache));
    return disposables;
}
