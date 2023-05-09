// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ExtensionContext, window } from "vscode";
import * as constants from "../constants";
import { setShowLineTicks, setShowProfile, setSortProfile } from "../services/context";
import { events } from "../services/events";
import { VSDisposableStack } from "../vscode/disposable";
import { DeoptsTree } from "./deopts/deoptTree";
import { FunctionsTree } from "./functions/functionTree";
import { IcsTree } from "./ics/icTree";
import { LineTickTree } from "./lineTicks/lineTickTree";
import { MapsTree } from "./map/mapsTree";
import { PickerTreeDataProvider } from "./picker/pickerTreeDataProvider";
import { WorkspaceWatcher } from "./picker/workspaceWatcher";
import { ProfileNodeFileDecorationProvider } from "./profile/profileNodeFileDecorationProvider";
import { ProfileTree } from "./profile/profileTree";

export async function activateTreeViewService(context: ExtensionContext) {
    const stack = new VSDisposableStack();
    try {
        const pickerProvider = new PickerTreeDataProvider();
        const pickerView = stack.use(window.createTreeView(constants.treeviews.pick, { treeDataProvider: pickerProvider }));
        pickerView.message = "To use this extension, you must open a v8 trace log file.";

        const pickerWatcher = stack.use(new WorkspaceWatcher(pickerProvider));
        pickerWatcher.startWatching();
        stack.use(events.onDidChangeRecentLogs(() => { pickerProvider.invalidate(); }));

        const icsTree = stack.use(new IcsTree());
        const deoptsTree = stack.use(new DeoptsTree());
        const functionsTree = stack.use(new FunctionsTree());
        const mapsTree = stack.use(new MapsTree());
        const profileTree = stack.use(new ProfileTree());
        const lineTickTree = stack.use(new LineTickTree());

        stack.use(window.registerFileDecorationProvider(new ProfileNodeFileDecorationProvider()));

        // Update tree views when context values change
        stack.use(events.onDidSortICsChange(value => { icsTree.setSortBy(value); }));
        stack.use(events.onDidShowICStatesChange(value => { icsTree.setShowICStates(value); }));
        stack.use(events.onDidGroupDeoptsChange(value => { deoptsTree.setGroupBy(value); }));
        stack.use(events.onDidSortDeoptsChange(value => { deoptsTree.setSortBy(value); }));
        stack.use(events.onDidSortMapsChange(value => { mapsTree.setSortBy(value); }));
        stack.use(events.onDidGroupMapsChange(value => { mapsTree.setGroupBy(value); }));
        stack.use(events.onDidShowMapsChange(value => { mapsTree.setFilter(value); }));
        stack.use(events.onDidSortProfileChange(value => { profileTree.setSortBy(value); }));
        stack.use(events.onDidShowProfileChange(value => { profileTree.setShowAs(value); }));
        stack.use(events.onDidShowProfileJustMyCodeChange(value => { profileTree.setShowJustMyCode(value); }));
        stack.use(events.onDidShowNativeCodeProfileNodesChange(value => { profileTree.setShowNativeCodeProfileNodes(value); }));
        stack.use(events.onDidShowNodeJsProfileNodesChange(value => { profileTree.setShowNodeJsProfileNodes(value); }));
        stack.use(events.onDidShowNodeModulesProfileNodesChange(value => { profileTree.setShowNodeModulesProfileNodes(value); }));

        // Update tree views when the log file changes
        stack.use(events.onWillOpenLogFile(async () => {
            pickerWatcher.stopWatching();
            functionsTree.closeLog();
            icsTree.closeLog();
            deoptsTree.closeLog();
            mapsTree.closeLog();
            profileTree.closeLog();
            lineTickTree.setProfileViewNodeSnapshot(undefined);
            await Promise.all([
                setSortProfile(constants.kDefaultProfileSortMode),
                setShowProfile(constants.kDefaultProfileShowMode),
                setShowLineTicks(false)
            ]);
        }));
        stack.use(events.onDidOpenLogFile(async ({ uri, log }) => {
            pickerWatcher.stopWatching();
            functionsTree.openLog(uri, log);
            icsTree.openLog(uri, log);
            deoptsTree.openLog(uri, log);
            mapsTree.openLog(uri, log);
            profileTree.openLog(uri, log);
            lineTickTree.setProfileViewNodeSnapshot(undefined);
            await Promise.all([
                setSortProfile(constants.kDefaultProfileSortMode),
                setShowProfile(constants.kDefaultProfileShowMode),
                setShowLineTicks(false)
            ]);
        }));
        stack.use(events.onDidCloseLogFile(async () => {
            pickerWatcher.startWatching();
            pickerProvider.invalidate();
            functionsTree.closeLog();
            icsTree.closeLog();
            deoptsTree.closeLog();
            mapsTree.closeLog();
            profileTree.closeLog();
            lineTickTree.setProfileViewNodeSnapshot(undefined);
            await Promise.all([
                setSortProfile(constants.kDefaultProfileSortMode),
                setShowProfile(constants.kDefaultProfileShowMode),
                setShowLineTicks(false)
            ]);
        }));
        stack.use(events.onDidChangeCurrentProfileViewNodeSnapshot(async snapshot => {
            lineTickTree.setProfileViewNodeSnapshot(snapshot);
            await setShowLineTicks(snapshot !== undefined);
        }));
        return stack.move();
    }
    finally {
        stack.dispose();
    }
}
