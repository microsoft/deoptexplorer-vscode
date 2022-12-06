// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable, ExtensionContext } from "vscode";
import { ProfileViewNodeSnapshot } from "../model/profileViewNodeSnapshot";
import { emitters } from "./events";

let activated = false;

export let currentProfileViewNodeSnapshot: ProfileViewNodeSnapshot | undefined;

export function setCurrentProfileViewNodeSnapshot(snapshot: ProfileViewNodeSnapshot | undefined) {
    if (currentProfileViewNodeSnapshot !== snapshot) {
        if (activated) emitters.willChangeCurrentProfileViewNodeSnapshot(currentProfileViewNodeSnapshot);
        currentProfileViewNodeSnapshot = snapshot;
        if (activated) emitters.didChangeCurrentProfileViewNodeSnapshot(currentProfileViewNodeSnapshot);
    }
}

export function activateStateManager(context: ExtensionContext) {
    activated = true;
    return Disposable.from(
        new Disposable(() => {
            currentProfileViewNodeSnapshot = undefined;
            activated = false;
        })
    );
}