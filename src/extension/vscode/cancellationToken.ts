// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Cancelable, CancelableCancelSignal, CancelError } from "@esfx/cancelable";
import { Disposable } from "@esfx/disposable";
import * as vscode from "vscode";

const weakCancelables = new WeakMap<vscode.CancellationToken, CancelableCancelSignal>();

export function cancellationTokenToCancelable(token: vscode.CancellationToken): Cancelable {
    let cancelable = weakCancelables.get(token);
    if (!cancelable) {
        let cancelError: vscode.CancellationError | undefined;
        weakCancelables.set(token, cancelable = {
            get signaled() {
                return token.isCancellationRequested;
            },
            get reason() {
                return cancelError ??= new vscode.CancellationError();
            },
            subscribe(onSignaled) {
                const disposable = token.onCancellationRequested(onSignaled);
                return {
                    unsubscribe() {
                        disposable.dispose();
                    },
                    [Disposable.dispose]() {
                        this.unsubscribe();
                    }
                };
            },
            [Cancelable.cancelSignal]() {
                return this;
            }
        });
    }
    return cancelable;
}

export function raceCancellationTokens(tokens: Iterable<vscode.CancellationToken>) {
    const source = new vscode.CancellationTokenSource();
    const tokensArray = [...tokens];
    for (const token of tokensArray) {
        if (token.isCancellationRequested) {
            source.cancel();
            return source.token;
        }
    }
    const subscriptions: vscode.Disposable[] = [];
    for (const token of tokensArray) {
        subscriptions.push(token.onCancellationRequested(() => { source.cancel(); }));
    }

    const container = vscode.Disposable.from(...subscriptions);
    source.token.onCancellationRequested(() => { container.dispose(); });
    return source.token;
}
