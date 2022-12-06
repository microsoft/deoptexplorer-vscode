// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable, DisposableLike, DisposableStack } from "@esfx/disposable";
import { Disposable as VSDisposable } from "vscode";

export function disposeVSDisposable(vsDisposable: VSDisposable) {
    vsDisposable.dispose();
}

export class VSDisposableStack extends DisposableStack {
    /**
     * Pushes a new disposable resource onto the disposable stack stack. Resources are disposed in the reverse order they were entered.
     * @param value The resource to add.
     * @returns The resource provided.
     */
    use<T extends VSDisposable | DisposableLike | null | undefined>(value: T): T;
    /**
     * Pushes a new disposable resource onto the disposable stack stack. Resources are disposed in the reverse order they were entered.
     * @param value The resource to add.
     * @param onDispose The operation to perform when the resource is disposed.
     * @returns The resource provided.
     */
    use<T>(value: T, onDispose: (value: T) => void): T;
    use<T>(value: T, onDispose?: (value: T) => void): T {
        if (onDispose === undefined &&
            typeof value === "object" &&
            value !== undefined &&
            !Disposable.hasInstance(value) &&
            typeof (value as VSDisposable).dispose === "function") {
            return super.use(value as T & VSDisposable, disposeVSDisposable);
        }
        return super.use(value, onDispose!);
    }

    /**
     * Moves all resources out of this `DisposableStack` and into a new `DisposableStack` and returns it.
     */
    move(): VSDisposableStack {
        const stack = super.move();
        if (stack instanceof VSDisposableStack) {
            return stack;
        }
        const vsStack = new VSDisposableStack();
        vsStack.use(stack);
        return vsStack;
    }
}