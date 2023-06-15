// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AsyncMutex } from "@esfx/async-mutex";
import { writeFileAsync } from "#core/fs.js";
import * as path from "path";
import { Disposable, ExtensionContext, Location, Position, ProviderResult, Uri, window } from "vscode";
import * as constants from "./constants";
import { MapId } from "./model/mapEntry";
import { log } from "./outputChannel";
import { CanonicalUri } from "./services/canonicalPaths";
import { groupDeopts, groupMaps, setGroupDeopts, setGroupMaps, setShowDecorations, setShowICStates, setShowLineTicks, setShowMaps, setShowNativeCodeProfileNodes, setShowNodeJsProfileNodes, setShowNodeModulesProfileNodes, setShowProfile, setShowProfileJustMyCode, setSortDeopts, setSortICs, setSortMaps, setSortProfile, showDecorations, showICStates, showMaps } from "./services/context";
import { closeLogFile, openedFile, openedLog, openLogFile } from "./services/currentLogFile";
import { emitters } from "./services/events";
import { cancelPendingOperations, diskOperationToken } from "./services/operationManager";
import * as storage from "./services/storage";
import { showMapAsReference } from "./textDocumentContentProviders/map";
import { cancellationTokenToCancelable } from "./vscode/cancellationToken";
import { typeSafeRegisterCommand } from "./vscode/commands";
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
        [constants.commands.log.showReport]: () => void;
        [constants.commands.log.clearRecent]: () => void;
        [constants.commands.log.removeRecent]: (context: ContextCommandHandler) => void;
        [constants.commands.functions.showFunctionHistory]: (filePosition: Location) => void;
        [constants.commands.ics.sortByLocation]: () => void;
        [constants.commands.ics.sortByState]: () => void;
        [constants.commands.ics.showStateMegamorphic]: () => void;
        [constants.commands.ics.showStatePolymorphic]: () => void;
        [constants.commands.ics.showStateMonomorphic]: () => void;
        [constants.commands.ics.showStateOther]: () => void;
        [constants.commands.ics.hideStateMegamorphic]: () => void;
        [constants.commands.ics.hideStatePolymorphic]: () => void;
        [constants.commands.ics.hideStateMonomorphic]: () => void;
        [constants.commands.ics.hideStateOther]: () => void;
        [constants.commands.deopts.sortByLocation]: () => void;
        [constants.commands.deopts.sortByKind]: () => void;
        [constants.commands.deopts.sortByCount]: () => void;
        [constants.commands.deopts.groupByFile]: () => void;
        [constants.commands.deopts.groupByFunction]: () => void;
        [constants.commands.deopts.groupByKind]: () => void;
        [constants.commands.deopts.ungroupByFile]: () => void;
        [constants.commands.deopts.ungroupByFunction]: () => void;
        [constants.commands.deopts.ungroupByKind]: () => void;
        [constants.commands.maps.showMap]: (mapIds: string[], file: CanonicalUri, line: number, character: number) => void;
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
                await openLogFile(uri);
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
                await openLogFile(file);
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

        // Clear recent V8 Logs
        typeSafeRegisterCommand(constants.commands.log.clearRecent, async () => {
            if (storage.getRecentFiles().length) {
                emitters.willChangeRecentLogs();
                await storage.setRecentFiles([]);
                emitters.didChangeRecentLogs();
            }
        }),

        // Remove recent V8 Log
        typeSafeRegisterCommand(constants.commands.log.removeRecent, async (context: ContextCommandHandler) => {
            if (context instanceof ContextCommandHandler) {
                await context.onCommand(constants.commands.log.removeRecent);
            }
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

        // ICs
        typeSafeRegisterCommand(constants.commands.ics.sortByLocation, async () => {
            await setSortICs(constants.SortICs.ByLocation);
        }),
        typeSafeRegisterCommand(constants.commands.ics.sortByState, async () => {
            await setSortICs(constants.SortICs.ByState);
        }),
        typeSafeRegisterCommand(constants.commands.ics.showStateMegamorphic, async () => {
            await setShowICStates(showICStates.add(constants.ShowICStates.Megamorphic));
        }),
        typeSafeRegisterCommand(constants.commands.ics.showStatePolymorphic, async () => {
            await setShowICStates(showICStates.add(constants.ShowICStates.Polymorphic));
        }),
        typeSafeRegisterCommand(constants.commands.ics.showStateMonomorphic, async () => {
            await setShowICStates(showICStates.add(constants.ShowICStates.Monomorphic));
        }),
        typeSafeRegisterCommand(constants.commands.ics.showStateOther, async () => {
            await setShowICStates(showICStates.add(constants.ShowICStates.Other));
        }),
        typeSafeRegisterCommand(constants.commands.ics.hideStateMegamorphic, async () => {
            await setShowICStates(showICStates.delete(constants.ShowICStates.Megamorphic));
        }),
        typeSafeRegisterCommand(constants.commands.ics.hideStatePolymorphic, async () => {
            await setShowICStates(showICStates.delete(constants.ShowICStates.Polymorphic));
        }),
        typeSafeRegisterCommand(constants.commands.ics.hideStateMonomorphic, async () => {
            await setShowICStates(showICStates.delete(constants.ShowICStates.Monomorphic));
        }),
        typeSafeRegisterCommand(constants.commands.ics.hideStateOther, async () => {
            await setShowICStates(showICStates.delete(constants.ShowICStates.Other));
        }),

        // Deopts
        typeSafeRegisterCommand(constants.commands.deopts.sortByLocation, async () => {
            await setSortDeopts(constants.SortDeopts.ByLocation);
        }),
        typeSafeRegisterCommand(constants.commands.deopts.sortByKind, async () => {
            await setSortDeopts(constants.SortDeopts.ByKind);
        }),
        typeSafeRegisterCommand(constants.commands.deopts.sortByCount, async () => {
            await setSortDeopts(constants.SortDeopts.ByCount);
        }),
        typeSafeRegisterCommand(constants.commands.deopts.groupByFile, async () => {
            await setGroupDeopts(groupDeopts.add(constants.GroupDeopts.ByFile));
        }),
        typeSafeRegisterCommand(constants.commands.deopts.groupByFunction, async () => {
            await setGroupDeopts(groupDeopts.add(constants.GroupDeopts.ByFunction));
        }),
        typeSafeRegisterCommand(constants.commands.deopts.groupByKind, async () => {
            await setGroupDeopts(groupDeopts.add(constants.GroupDeopts.ByKind));
        }),
        typeSafeRegisterCommand(constants.commands.deopts.ungroupByFile, async () => {
            await setGroupDeopts(groupDeopts.delete(constants.GroupDeopts.ByFile));
        }),
        typeSafeRegisterCommand(constants.commands.deopts.ungroupByFunction, async () => {
            await setGroupDeopts(groupDeopts.delete(constants.GroupDeopts.ByFunction));
        }),
        typeSafeRegisterCommand(constants.commands.deopts.ungroupByKind, async () => {
            await setGroupDeopts(groupDeopts.delete(constants.GroupDeopts.ByKind));
        }),

        // Maps
        typeSafeRegisterCommand(constants.commands.maps.sortByName, async () => {
            await setSortMaps(constants.MapSortMode.ByName);
        }),
        typeSafeRegisterCommand(constants.commands.maps.sortByCount, async () => {
            await setSortMaps(constants.MapSortMode.ByCount);
        }),
        typeSafeRegisterCommand(constants.commands.maps.showUnreferenced, async () => {
            await setShowMaps(showMaps.add(constants.ShowMaps.Unreferenced));
        }),
        typeSafeRegisterCommand(constants.commands.maps.hideUnreferenced, async () => {
            await setShowMaps(showMaps.delete(constants.ShowMaps.Unreferenced));
        }),
        typeSafeRegisterCommand(constants.commands.maps.showNonUserCode, async () => {
            await setShowMaps(showMaps.add(constants.ShowMaps.NonUserCode));
        }),
        typeSafeRegisterCommand(constants.commands.maps.hideNonUserCode, async () => {
            await setShowMaps(showMaps.delete(constants.ShowMaps.NonUserCode));
        }),
        typeSafeRegisterCommand(constants.commands.maps.showTransitions, async () => {
            await setShowMaps(showMaps.add(constants.ShowMaps.Transitions));
        }),
        typeSafeRegisterCommand(constants.commands.maps.hideTransitions, async () => {
            await setShowMaps(showMaps.delete(constants.ShowMaps.Transitions));
        }),
        typeSafeRegisterCommand(constants.commands.maps.groupByFile, async () => {
            await setGroupMaps(groupMaps.add(constants.GroupMaps.ByFile));
        }),
        typeSafeRegisterCommand(constants.commands.maps.groupByFunction, async () => {
            await setGroupMaps(groupMaps.add(constants.GroupMaps.ByFunction));
        }),
        typeSafeRegisterCommand(constants.commands.maps.ungroupByFile, async () => {
            await setGroupMaps(groupMaps.delete(constants.GroupMaps.ByFile));
        }),
        typeSafeRegisterCommand(constants.commands.maps.ungroupByFunction, async () => {
            await setGroupMaps(groupMaps.delete(constants.GroupMaps.ByFunction));
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
            await setShowDecorations(showDecorations.add(constants.ShowDecorations.Deopts));
        }),
        typeSafeRegisterCommand(constants.commands.decorations.hideDeopts, async () => {
            await setShowDecorations(showDecorations.delete(constants.ShowDecorations.Deopts));
        }),
        typeSafeRegisterCommand(constants.commands.decorations.showICs, async () => {
            await setShowDecorations(showDecorations.add(constants.ShowDecorations.ICs));
        }),
        typeSafeRegisterCommand(constants.commands.decorations.hideICs, async () => {
            await setShowDecorations(showDecorations.delete(constants.ShowDecorations.ICs));
        }),
        typeSafeRegisterCommand(constants.commands.decorations.showFunctionStates, async () => {
            await setShowDecorations(showDecorations.add(constants.ShowDecorations.Functions));
        }),
        typeSafeRegisterCommand(constants.commands.decorations.hideFunctionStates, async () => {
            await setShowDecorations(showDecorations.delete(constants.ShowDecorations.Functions));
        }),
        typeSafeRegisterCommand(constants.commands.decorations.showProfiler, async () => {
            await setShowDecorations(showDecorations.add(constants.ShowDecorations.Profiler));
        }),
        typeSafeRegisterCommand(constants.commands.decorations.hideProfiler, async () => {
            await setShowDecorations(showDecorations.delete(constants.ShowDecorations.Profiler));
        }),
        typeSafeRegisterCommand(constants.commands.decorations.showLineTicks, async () => {
            await setShowDecorations(showDecorations.add(constants.ShowDecorations.LineTicks));
        }),
        typeSafeRegisterCommand(constants.commands.decorations.hideLineTicks, async () => {
            await setShowDecorations(showDecorations.delete(constants.ShowDecorations.LineTicks));
        }),
        typeSafeRegisterCommand(constants.commands.decorations.hideAll, async () => {
            await setShowDecorations(showDecorations.clear());
        }),
        typeSafeRegisterCommand(constants.commands.profile.showLineTickDecorationsForNode, async (context) => {
            if (context instanceof ContextCommandHandler) {
                await context.onCommand(constants.commands.profile.showLineTickDecorationsForNode);
            }
        }),
        typeSafeRegisterCommand(constants.commands.profile.hideLineTicks, async () => {
            await setShowLineTicks(false);
            await setShowDecorations(showDecorations.delete(constants.ShowDecorations.LineTicks));
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