// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable, ExtensionContext, Uri } from "vscode";
import { ImmutableEnumSet } from "#core/collections/enumSet.js";
import { deserialize, serialize } from "#core/serializer.js";
import * as constants from "../constants";

let currentContext: ExtensionContext | undefined;
let recentFiles: Uri[] | undefined;
let showJustMyCode = constants.kDefaultShowJustMyCode;
let showNativeCodeProfileNodes = constants.kDefaultShowNativeCodeProfileNodes;
let showNodeJsProfileNodes = constants.kDefaultShowNodeJsProfileNodes;
let showNodeModulesProfileNodes = constants.kDefaultShowNodeModulesProfileNodes;
let sortICs = constants.kDefaultSortICs;
let showICStates = constants.kDefaultShowICStates;
let groupDeopts = constants.kDefaultGroupDeopts;
let sortDeopts = constants.kDefaultSortDeopts;
let groupMaps = constants.kDefaultGroupMaps;
let showMaps = constants.kDefaultShowMaps;
let sortMaps = constants.kDefaultMapSortMode;

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

export function getSortDeopts() {
    return sortDeopts;
}

export async function setSortDeopts(value: constants.SortDeopts) {
    if (!currentContext) return;
    sortDeopts = value;
    await currentContext.globalState.update(constants.storage.sortDeopts, value);
}

export function getGroupDeopts() {
    return groupDeopts;
}

export async function setGroupDeopts(value: ImmutableEnumSet<constants.GroupDeopts>) {
    if (!currentContext) return;
    groupDeopts = value;
    await currentContext.globalState.update(constants.storage.groupDeopts, [...value]);
}

export function getSortICs() {
    return sortICs;
}

export async function setSortICs(value: constants.SortICs) {
    if (!currentContext) return;
    sortICs = value;
    await currentContext.globalState.update(constants.storage.sortICs, value);
}

export function getShowICStates() {
    return showICStates;
}

export async function setShowICStates(value: ImmutableEnumSet<constants.ShowICStates>) {
    if (!currentContext) return;
    showICStates = value;
    await currentContext.globalState.update(constants.storage.showICStates, [...value]);
}

export function getGroupMaps() {
    return groupMaps;
}

export async function setGroupMaps(value: ImmutableEnumSet<constants.GroupMaps>) {
    if (!currentContext) return;
    groupMaps = value;
    await currentContext.globalState.update(constants.storage.groupMaps, [...value]);
}

export function getShowMaps() {
    return showMaps;
}

export async function setShowMaps(value: ImmutableEnumSet<constants.ShowMaps>) {
    if (!currentContext) return;
    showMaps = value;
    await currentContext.globalState.update(constants.storage.showMaps, [...value]);
}

export function getSortMaps() {
    return sortMaps;
}

export async function setSortMaps(value: constants.MapSortMode) {
    if (!currentContext) return;
    sortMaps = value;
    await currentContext.globalState.update(constants.storage.sortMaps, value);
}

export function activateStorageService(context: ExtensionContext) {
    currentContext = context;

    recentFiles = deserialize(currentContext.globalState.get<unknown>(constants.storage.recentFiles)) as Uri[] | undefined ?? [];
    showJustMyCode = currentContext.globalState.get<boolean>(constants.storage.showJustMyCode, constants.kDefaultShowJustMyCode);
    showNativeCodeProfileNodes = currentContext.globalState.get<boolean>(constants.storage.showNativeCodeProfileNodes, constants.kDefaultShowNativeCodeProfileNodes);
    showNodeJsProfileNodes = currentContext.globalState.get<boolean>(constants.storage.showNodeJsProfileNodes, constants.kDefaultShowNodeJsProfileNodes);
    showNodeModulesProfileNodes = currentContext.globalState.get<boolean>(constants.storage.showNodeModulesProfileNodes, constants.kDefaultShowNodeModulesProfileNodes);
    sortICs = currentContext.globalState.get<constants.SortICs>(constants.storage.sortICs, constants.kDefaultSortICs);
    showICStates = new ImmutableEnumSet(currentContext.globalState.get<readonly constants.ShowICStates[]>(constants.storage.showICStates) ?? constants.kDefaultShowICStates);
    sortDeopts = currentContext.globalState.get<constants.SortDeopts>(constants.storage.sortDeopts, constants.kDefaultSortDeopts);
    groupDeopts = new ImmutableEnumSet(currentContext.globalState.get<readonly constants.GroupDeopts[]>(constants.storage.groupDeopts) ?? constants.kDefaultGroupDeopts);
    groupMaps = new ImmutableEnumSet(currentContext.globalState.get<readonly constants.GroupMaps[]>(constants.storage.groupMaps) ?? constants.kDefaultGroupMaps);
    showMaps = new ImmutableEnumSet(currentContext.globalState.get<readonly constants.ShowMaps[]>(constants.storage.showMaps) ?? constants.kDefaultShowMaps);
    sortMaps = currentContext.globalState.get<constants.MapSortMode>(constants.storage.sortMaps, constants.kDefaultMapSortMode);

    return new Disposable(() => {
        currentContext = undefined;
        recentFiles = undefined;
        showJustMyCode = constants.kDefaultShowJustMyCode;
        showNativeCodeProfileNodes = constants.kDefaultShowNativeCodeProfileNodes;
        showNodeJsProfileNodes = constants.kDefaultShowNodeJsProfileNodes;
        showNodeModulesProfileNodes = constants.kDefaultShowNodeModulesProfileNodes;
        sortICs = constants.kDefaultSortICs;
        showICStates = constants.kDefaultShowICStates;
        groupDeopts = constants.kDefaultGroupDeopts;
        sortDeopts = constants.kDefaultSortDeopts;
        groupMaps = constants.kDefaultGroupMaps;
        showMaps = constants.kDefaultShowMaps;
        sortMaps = constants.kDefaultMapSortMode;
    });
}