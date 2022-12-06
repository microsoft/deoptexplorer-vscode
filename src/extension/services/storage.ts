// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable, ExtensionContext, Uri } from "vscode";
import { deserialize, serialize } from "../../core/serializer";
import * as constants from "../constants";

let currentContext: ExtensionContext | undefined;
let recentFiles: Uri[] | undefined;
let showJustMyCode = constants.kDefaultShowJustMyCode;
let showNativeCodeProfileNodes = constants.kDefaultShowNativeCodeProfileNodes;
let showNodeJsProfileNodes = constants.kDefaultShowNodeJsProfileNodes;
let showNodeModulesProfileNodes = constants.kDefaultShowNodeModulesProfileNodes;

export function getRecentFiles() {
    return recentFiles?.slice() ?? [];
}

export async function setRecentFiles(files: Uri[]) {
    if (!currentContext) return;
    recentFiles = files.slice();
    await currentContext.globalState.update(constants.storage.recentFiles, serialize(recentFiles));
}

export function getShowJustMyCode() {
    return showJustMyCode;
}

export async function setShowJustMyCode(value: boolean) {
    if (!currentContext) return;
    showJustMyCode = value;
    await currentContext.globalState.update(constants.storage.showJustMyCode, value);
}

export function getShowNativeCodeProfileNodes() {
    return showNativeCodeProfileNodes;
}

export async function setShowNativeCodeProfileNodes(value: boolean) {
    if (!currentContext) return;
    showNativeCodeProfileNodes = value;
    await currentContext.globalState.update(constants.storage.showNativeCodeProfileNodes, value);
}

export function getShowNodeJsProfileNodes() {
    return showNodeJsProfileNodes;
}

export async function setShowNodeJsProfileNodes(value: boolean) {
    if (!currentContext) return;
    showNodeJsProfileNodes = value;
    await currentContext.globalState.update(constants.storage.showNodeJsProfileNodes, value);
}

export function getShowNodeModulesProfileNodes() {
    return showNodeModulesProfileNodes;
}

export async function setShowNodeModulesProfileNodes(value: boolean) {
    if (!currentContext) return;
    showNodeModulesProfileNodes = value;
    await currentContext.globalState.update(constants.storage.showNodeModulesProfileNodes, value);
}

export function activateStorageService(context: ExtensionContext) {
    currentContext = context;

    recentFiles = deserialize(currentContext.globalState.get<unknown>(constants.storage.recentFiles)) as Uri[] | undefined ?? [];
    showJustMyCode = currentContext.globalState.get<boolean>(constants.storage.showJustMyCode, constants.kDefaultShowJustMyCode);
    showNativeCodeProfileNodes = currentContext.globalState.get<boolean>(constants.storage.showNativeCodeProfileNodes, constants.kDefaultShowNativeCodeProfileNodes);
    showNodeJsProfileNodes = currentContext.globalState.get<boolean>(constants.storage.showNodeJsProfileNodes, constants.kDefaultShowNodeJsProfileNodes);
    showNodeModulesProfileNodes = currentContext.globalState.get<boolean>(constants.storage.showNodeModulesProfileNodes, constants.kDefaultShowNodeModulesProfileNodes);

    return new Disposable(() => {
        currentContext = undefined;
        recentFiles = undefined;
        showJustMyCode = constants.kDefaultShowJustMyCode;
        showNativeCodeProfileNodes = constants.kDefaultShowNativeCodeProfileNodes;
        showNodeJsProfileNodes = constants.kDefaultShowNodeJsProfileNodes;
        showNodeModulesProfileNodes = constants.kDefaultShowNodeModulesProfileNodes;
    });
}