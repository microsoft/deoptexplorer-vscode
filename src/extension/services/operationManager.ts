// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CancellationTokenSource, Disposable, ExtensionContext } from "vscode";

let extensionSource = new CancellationTokenSource();
let diskOperationSource = new CancellationTokenSource();
let uiOperationSource = new CancellationTokenSource();

export let extensionToken = extensionSource.token;
export let diskOperationToken = diskOperationSource.token;
export let uiOperationToken = uiOperationSource.token;

let diskOperationSubscription = extensionToken.onCancellationRequested(cancelPendingIOOperation);
let uiOperationSubscription = extensionToken.onCancellationRequested(cancelPendingUIOperation);

export function cancelPendingOperations() {
    const oldExtensionSource = extensionSource;
    extensionSource = new CancellationTokenSource();
    extensionToken = extensionSource.token;
    oldExtensionSource.cancel();
}

export function cancelPendingIOOperation() {
    const oldDiskOperationSource = diskOperationSource;
    diskOperationSubscription.dispose();
    diskOperationSource = new CancellationTokenSource();
    diskOperationToken = diskOperationSource.token;
    diskOperationSubscription = extensionToken.onCancellationRequested(cancelPendingIOOperation);
    oldDiskOperationSource.cancel();
}

export function cancelPendingUIOperation() {
    const oldUIOperationSource = uiOperationSource;
    uiOperationSubscription.dispose();
    uiOperationSource = new CancellationTokenSource();
    uiOperationToken = uiOperationSource.token;
    uiOperationSubscription = extensionToken.onCancellationRequested(cancelPendingUIOperation);
    oldUIOperationSource.cancel();
}

export function activateOperationManagerService(context: ExtensionContext) {
    return new Disposable(cancelPendingOperations);
}
