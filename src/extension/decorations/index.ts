// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ExtensionContext } from "vscode";
import { VSDisposableStack } from "../vscode/disposable";
import { activateDeoptDecorations } from "./deoptDecorations";
import { activateFunctionStateDecorations } from "./functionStateDecorations";
import { activateICDecorations } from "./icDecorations";
import { activateProfilerDecorations } from "./profilerDecorations";

export function activateDecorations(context: ExtensionContext) {
    const stack = new VSDisposableStack();
    try {
        stack.use(activateICDecorations(context));
        stack.use(activateDeoptDecorations(context));
        stack.use(activateFunctionStateDecorations(context));
        stack.use(activateProfilerDecorations(context));
        return stack.move();
    }
    finally {
        stack.dispose();
    }
}