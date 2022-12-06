// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AsyncMutex } from "@esfx/async-mutex";
import { except, union } from "@esfx/iter-fn";
import * as path from "path";
import { Disposable, ExtensionContext, Location, Position, ProviderResult, QuickPickItem, Uri, window } from "vscode";
import { writeFileAsync } from "../core/fs";
import * as constants from "./constants";
import { MapId } from "./model/mapEntry";
import { log } from "./outputChannel";
import { CanonicalUri } from "./services/canonicalPaths";
import { setShowDecorations, setShowProfileJustMyCode, setShowLineTicks, setShowMaps, setShowNativeCodeProfileNodes, setShowNodeJsProfileNodes, setShowNodeModulesProfileNodes, setShowProfile, setSortMaps, setSortProfile, showDecorations, showMaps, setGroupMaps, groupMaps } from "./services/context";
import { closeLogFile, openedFile, openedLog, openLogFile } from "./services/currentLogFile";
import { cancelPendingOperations, diskOperationToken } from "./services/operationManager";
import { showMapAsReference } from "./textDocumentContentProviders/map";
import { cancellationTokenToCancelable } from "./vscode/cancellationToken";
import { typeSafeExecuteCommand, typeSafeRegisterCommand } from "./vscode/commands";
import { showFunctionHistory } from "./webviewViews/functionHistory";
import { showReportView } from "./webviewViews/report";

const openMutex = new AsyncMutex();

export abstract class ContextCommandHandler {
    abstract onCommand(commandName: string): ProviderResult<void>;
}

declare global {
    interface KnownCommands {
        [constants.commands.cancel]: () => void;
        [constants.commands.log.open]: (uri?: Uri) => void;
        [constants.commands.log.reload]: () => void;
        [constants.commands.log.close]: () => void;
        [constants.commands.maps.showMap]: (mapIds: string[], file: CanonicalUri, line: number, character: number) => void;
        [constants.commands.functions.showFunctionHistory]: (filePosition: Location) => void;
        [constants.commands.log.showReport]: () => void;
        [constants.commands.maps.sortByName]: () => void;
        [constants.commands.maps.sortByCount]: () => void;
        [constants.commands.maps.showUnreferenced]: () => void;
        [constants.commands.maps.hideUnreferenced]: () => void;
        [constants.commands.maps.showNonUserCode]: () => void;
        [constants.commands.maps.hideNonUserCode]: () => void;
        [constants.commands.maps.showTransitions]: () => void;
        [constants.commands.maps.hideTransitions]: () => void;
        [constants.commands.maps.groupByFile]: () => void;
        [constants.commands.maps.groupByFunction]: () => void;
        [constants.commands.maps.ungroupByFile]: () => void;
        [constants.commands.maps.ungroupByFunction]: () => void;
        [constants.commands.profile.sortBySelfTime]: () => void;
        [constants.commands.profile.sortByTotalTime]: () => void;
        [constants.commands.profile.sortByName]: () => void;
        [constants.commands.profile.showCallTree]: () => void;
        [constants.commands.profile.showBottomUp]: () => void;
        [constants.commands.profile.showFlat]: () => void;
        [constants.commands.profile.enableJustMyCode]: () => void;
        [constants.commands.profile.disableJustMyCode]: () => void;
        [constants.commands.profile.showNativeCode]: () => void;
        [constants.commands.profile.hideNativeCode]: () => void;
        [constants.commands.profile.showNodeJs]: () => void;
        [constants.commands.profile.hideNodeJs]: () => void;
        [constants.commands.profile.showNodeModules]: () => void;
        [constants.commands.profile.hideNodeModules]: () => void;
        [constants.commands.decorations.showDeopts]: () => void;
        [constants.commands.decorations.hideDeopts]: () => void;
        [constants.commands.decorations.showICs]: () => void;
        [constants.commands.decorations.hideICs]: () => void;
        [constants.commands.decorations.showFunctionStates]: () => void;
        [constants.commands.decorations.hideFunctionStates]: () => void;
        [constants.commands.decorations.showProfiler]: () => void;
        [constants.commands.decorations.hideProfiler]: () => void;
        [constants.commands.decorations.showLineTicks]: () => void;
        [constants.commands.decorations.hideLineTicks]: () => void;
        [constants.commands.decorations.hideAll]: () => void;
        [constants.commands.profile.showLineTickDecorationsForNode]: (context: ContextCommandHandler) => void;
        [constants.commands.profile.hideLineTicks]: () => void;
        [constants.commands.profile.exportProfile]: () => void;
    }
}

export function activateCommands(context: ExtensionContext) {
    return Disposable.from(
        // Cancel the running operation
        typeSafeRegisterCommand(constants.commands.cancel, cancelPendingOperations),

        // Open a V8 Log
        typeSafeRegisterCommand(constants.commands.log.open, async (uri?: Uri) => {
            cancelPendingOperations();
            const lock = await openMutex.lock(cancellationTokenToCancelable(diskOperationToken));
            try {
                await openLogFile(uri, /*force*/ false);
            }
            catch (e) {
                closeLogFile();
                log(e);
                throw e;
            }
            finally {
                lock.unlock();
            }
        }),

        // Reload the current V8 Log
        typeSafeRegisterCommand(constants.commands.log.reload, async () => {
            const file = openedFile;
            if (!file) return;
            cancelPendingOperations();
            const lock = await openMutex.lock(cancellationTokenToCancelable(diskOperationToken));
            try {
                await openLogFile(file, /*force*/ true);
            }
            catch (e) {
                closeLogFile();
                log(e);
                throw e;
            }
            finally {
                lock.unlock();
            }
        }),

        // Close the current V8 Log
        typeSafeRegisterCommand(constants.commands.log.close, async () => {
            closeLogFile();
        }),

        // Show information about a map
        typeSafeRegisterCommand(constants.commands.maps.showMap, (mapIds: string[], file: CanonicalUri, line: number, character: number) => {
            showMapAsReference(mapIds.map(MapId.parse), file, new Position(line, character));
        }),

        // Show information about a function
        typeSafeRegisterCommand(constants.commands.functions.showFunctionHistory, (filePosition) => {
            const entry = openedLog?.findFunctionEntryByFilePosition(filePosition);
            if (entry) {
                showFunctionHistory(entry);
            }
        }),

        // Show report
        typeSafeRegisterCommand(constants.commands.log.showReport, () => {
            showReportView();
        }),

        // Maps
        typeSafeRegisterCommand(constants.commands.maps.sortByName, async () => {
            await setSortMaps(constants.MapSortMode.ByName);
        }),
        typeSafeRegisterCommand(constants.commands.maps.sortByCount, async () => {
            await setSortMaps(constants.MapSortMode.ByCount);
        }),
        typeSafeRegisterCommand(constants.commands.maps.showUnreferenced, async () => {
            await setShowMaps([...union(showMaps, [constants.ShowMaps.Unreferenced])]);
        }),
        typeSafeRegisterCommand(constants.commands.maps.hideUnreferenced, async () => {
            await setShowMaps([...except(showMaps, [constants.ShowMaps.Unreferenced])]);
        }),
        typeSafeRegisterCommand(constants.commands.maps.showNonUserCode, async () => {
            await setShowMaps([...union(showMaps, [constants.ShowMaps.NonUserCode])]);
        }),
        typeSafeRegisterCommand(constants.commands.maps.hideNonUserCode, async () => {
            await setShowMaps([...except(showMaps, [constants.ShowMaps.NonUserCode])]);
        }),
        typeSafeRegisterCommand(constants.commands.maps.showTransitions, async () => {
            await setShowMaps([...union(showMaps, [constants.ShowMaps.Transitions])]);
        }),
        typeSafeRegisterCommand(constants.commands.maps.hideTransitions, async () => {
            await setShowMaps([...except(showMaps, [constants.ShowMaps.Transitions])]);
        }),
        typeSafeRegisterCommand(constants.commands.maps.groupByFile, async () => {
            await setGroupMaps([...union(groupMaps, [constants.GroupMaps.ByFile])]);
        }),
        typeSafeRegisterCommand(constants.commands.maps.groupByFunction, async () => {
            await setGroupMaps([...union(groupMaps, [constants.GroupMaps.ByFunction])]);
        }),
        typeSafeRegisterCommand(constants.commands.maps.ungroupByFile, async () => {
            await setGroupMaps([...except(groupMaps, [constants.GroupMaps.ByFile])]);
        }),
        typeSafeRegisterCommand(constants.commands.maps.ungroupByFunction, async () => {
            await setGroupMaps([...except(groupMaps, [constants.GroupMaps.ByFunction])]);
        }),

        // Profile
        typeSafeRegisterCommand(constants.commands.profile.sortBySelfTime, async () => {
            await setSortProfile(constants.ProfileSortMode.BySelfTime);
        }),
        typeSafeRegisterCommand(constants.commands.profile.sortByTotalTime, async () => {
            await setSortProfile(constants.ProfileSortMode.ByTotalTime);
        }),
        typeSafeRegisterCommand(constants.commands.profile.sortByName, async () => {
            await setSortProfile(constants.ProfileSortMode.ByName);
        }),
        typeSafeRegisterCommand(constants.commands.profile.showCallTree, async () => {
            await setShowProfile(constants.ProfileShowMode.CallTree);
        }),
        typeSafeRegisterCommand(constants.commands.profile.showBottomUp, async () => {
            await setShowProfile(constants.ProfileShowMode.BottomUp);
        }),
        typeSafeRegisterCommand(constants.commands.profile.showFlat, async () => {
            await setShowProfile(constants.ProfileShowMode.Flat);
        }),
        typeSafeRegisterCommand(constants.commands.profile.enableJustMyCode, async () => {
            await setShowProfileJustMyCode(true);
        }),
        typeSafeRegisterCommand(constants.commands.profile.disableJustMyCode, async () => {
            await setShowProfileJustMyCode(false);
        }),
        typeSafeRegisterCommand(constants.commands.profile.showNativeCode, async () => {
            await setShowNativeCodeProfileNodes(true);
        }),
        typeSafeRegisterCommand(constants.commands.profile.hideNativeCode, async () => {
            await setShowNativeCodeProfileNodes(false);
        }),
        typeSafeRegisterCommand(constants.commands.profile.showNodeJs, async () => {
            await setShowNodeJsProfileNodes(true);
        }),
        typeSafeRegisterCommand(constants.commands.profile.hideNodeJs, async () => {
            await setShowNodeJsProfileNodes(false);
        }),
        typeSafeRegisterCommand(constants.commands.profile.showNodeModules, async () => {
            await setShowNodeModulesProfileNodes(true);
        }),
        typeSafeRegisterCommand(constants.commands.profile.hideNodeModules, async () => {
            await setShowNodeModulesProfileNodes(false);
        }),

        // Decorations
        typeSafeRegisterCommand(constants.commands.decorations.showDeopts, async () => {
            await setShowDecorations([...union(showDecorations, [constants.ShowDecorations.Deopts])]);
        }),
        typeSafeRegisterCommand(constants.commands.decorations.hideDeopts, async () => {
            await setShowDecorations([...except(showDecorations, [constants.ShowDecorations.Deopts])]);
        }),
        typeSafeRegisterCommand(constants.commands.decorations.showICs, async () => {
            await setShowDecorations([...union(showDecorations, [constants.ShowDecorations.ICs])]);
        }),
        typeSafeRegisterCommand(constants.commands.decorations.hideICs, async () => {
            await setShowDecorations([...except(showDecorations, [constants.ShowDecorations.ICs])]);
        }),
        typeSafeRegisterCommand(constants.commands.decorations.showFunctionStates, async () => {
            await setShowDecorations([...union(showDecorations, [constants.ShowDecorations.Functions])]);
        }),
        typeSafeRegisterCommand(constants.commands.decorations.hideFunctionStates, async () => {
            await setShowDecorations([...except(showDecorations, [constants.ShowDecorations.Functions])]);
        }),
        typeSafeRegisterCommand(constants.commands.decorations.showProfiler, async () => {
            await setShowDecorations([...union(showDecorations, [constants.ShowDecorations.Profiler])]);
        }),
        typeSafeRegisterCommand(constants.commands.decorations.hideProfiler, async () => {
            await setShowDecorations([...except(showDecorations, [constants.ShowDecorations.Profiler])]);
        }),
        typeSafeRegisterCommand(constants.commands.decorations.showLineTicks, async () => {
            await setShowDecorations([...union(showDecorations, [constants.ShowDecorations.LineTicks])]);
        }),
        typeSafeRegisterCommand(constants.commands.decorations.hideLineTicks, async () => {
            await setShowDecorations([...except(showDecorations, [constants.ShowDecorations.LineTicks])]);
        }),
        typeSafeRegisterCommand(constants.commands.decorations.hideAll, async () => {
            await setShowDecorations([]);
        }),
        typeSafeRegisterCommand(constants.commands.profile.showLineTickDecorationsForNode, async (context) => {
            if (context instanceof ContextCommandHandler) {
                await context.onCommand(constants.commands.profile.showLineTickDecorationsForNode);
            }
        }),
        typeSafeRegisterCommand(constants.commands.profile.hideLineTicks, async () => {
            await setShowLineTicks(false);
        }),

        // Export CPU profile
        typeSafeRegisterCommand(constants.commands.profile.exportProfile, async () => {
            if (openedFile && openedLog) {
                let file = openedFile.fsPath;
                file = path.join(path.dirname(file), path.basename(file, ".log") + ".cpuprofile");
                const result = await window.showSaveDialog({
                    defaultUri: Uri.file(file),
                    filters: {
                        "CPU Profiles": ["cpuprofile", "json"]
                    },
                });
                if (result) {
                    let rawProfile = openedLog.profile.getJSONProfile();
                    // rawProfile = ProfileTrimmer.trimProfile(openedLog.rawProfile, { trimUnused: true });
                    // rawProfile = SourceMapper.mapProfile(rawProfile);
                    let s = "";
                    s += `{\n`;
                    s += `  "startTime": ${JSON.stringify(rawProfile.startTime)},\n`;
                    s += `  "endTime": ${JSON.stringify(rawProfile.endTime)},\n`;
                    s += `  "samples": ${JSON.stringify(rawProfile.samples)},\n`;
                    s += `  "timeDeltas": ${JSON.stringify(rawProfile.timeDeltas)},\n`;
                    s += `  "nodes": ${JSON.stringify(rawProfile.nodes)}\n`;
                    s += `}\n`;
                    await writeFileAsync(result, s);
                }
            }
        })
    );
}