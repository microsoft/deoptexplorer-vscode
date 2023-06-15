// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * This file manages the various context values used in commands and views for `enablement` and `when` clauses.
 */

import { ImmutableEnumSet } from "#core/collections/enumSet.js";
import { Disposable, ExtensionContext } from "vscode";
import {
    contextKeys,
    GroupDeopts,
    GroupMaps,
    kDefaultGroupDeopts,
    kDefaultGroupMaps,
    kDefaultLogStatus,
    kDefaultMapSortMode,
    kDefaultProfileShowMode,
    kDefaultProfileSortMode,
    kDefaultShowDecorations,
    kDefaultShowICStates,
    kDefaultShowJustMyCode,
    kDefaultShowLineTicks,
    kDefaultShowMaps,
    kDefaultShowNativeCodeProfileNodes,
    kDefaultShowNodeJsProfileNodes,
    kDefaultShowNodeModulesProfileNodes,
    kDefaultSortDeopts,
    kDefaultSortICs,
    LogStatus,
    MapSortMode,
    ProfileShowMode,
    ProfileSortMode,
    ShowDecorations,
    ShowICStates,
    ShowMaps,
    SortDeopts,
    SortICs,
} from "../constants";
import { typeSafeExecuteCommand } from "../vscode/commands";
import { emitters } from "./events";
import * as storage from "./storage";

let currentContext: ExtensionContext | undefined;

export let logStatus = kDefaultLogStatus;
export let sortICs = kDefaultSortICs;
export let showICStates = kDefaultShowICStates;
export let sortDeopts = kDefaultSortDeopts;
export let groupDeopts = kDefaultGroupDeopts;
export let sortMaps = kDefaultMapSortMode;
export let groupMaps = kDefaultGroupMaps;
export let showMaps = kDefaultShowMaps;
export let sortProfile = kDefaultProfileSortMode;
export let showProfile = kDefaultProfileShowMode;
export let showJustMyCode = kDefaultShowJustMyCode;
export let showNativeCodeProfileNodes = kDefaultShowNativeCodeProfileNodes;
export let showNodeJsProfileNodes = kDefaultShowNodeJsProfileNodes;
export let showNodeModulesProfileNodes = kDefaultShowNodeModulesProfileNodes;
export let showDecorations = kDefaultShowDecorations;
export let showLineTicks = kDefaultShowLineTicks;

function setContext(key: string, value: any) {
    return typeSafeExecuteCommand("setContext", key, value);
}

export async function setLogStatus(value: LogStatus) {
    if (logStatus !== value) {
        if (currentContext) {
            emitters.willLogStatusChange();
        }
        logStatus = value;
        if (currentContext) {
            await setContext(contextKeys.logStatus, value);
            emitters.didLogStatusChange(value);
        }
    }
}

export async function setSortICs(value: SortICs) {
    if (sortICs !== value) {
        if (currentContext) {
            emitters.willSortICsChange();
        }
        sortICs = value;
        if (currentContext) {
            await Promise.all([
                storage.setSortICs(value),
                setContext(contextKeys.ics.sort, sortICs),
            ]);
            emitters.didSortICsChange(value);
        }
    }
}

export async function setShowICStates(value: ImmutableEnumSet<ShowICStates>) {
    if (!showICStates.equals(value)) {
        if (currentContext) {
            emitters.willShowICStatesChange();
        }
        showICStates = value;
        if (currentContext) {
            await Promise.all([
                storage.setShowICStates(value),
                setContext(contextKeys.ics.show.states, [...showICStates]),
                setContext(contextKeys.ics.show.state.megamorphic, showICStates.has(ShowICStates.Megamorphic)),
                setContext(contextKeys.ics.show.state.polymorphic, showICStates.has(ShowICStates.Polymorphic)),
                setContext(contextKeys.ics.show.state.monomorphic, showICStates.has(ShowICStates.Monomorphic)),
                setContext(contextKeys.ics.show.state.other, showICStates.has(ShowICStates.Other)),
            ]);
            emitters.didShowICStatesChange(value);
        }
    }
}

export async function setSortDeopts(value: SortDeopts) {
    if (sortDeopts !== value) {
        if (currentContext) {
            emitters.willSortDeoptsChange();
        }
        sortDeopts = value;
        if (currentContext) {
            await Promise.all([
                storage.setSortDeopts(value),
                setContext(contextKeys.deopts.sort, sortDeopts),
            ]);
            emitters.didSortDeoptsChange(value);
        }
    }
}

export async function setGroupDeopts(value: ImmutableEnumSet<GroupDeopts>) {
    if (!groupDeopts.equals(value)) {
        if (currentContext) {
            emitters.willGroupDeoptsChange();
        }
        groupDeopts = value;
        if (currentContext) {
            await Promise.all([
                storage.setGroupDeopts(value),
                setContext(contextKeys.deopts.groupByFile, groupDeopts.has(GroupDeopts.ByFile)),
                setContext(contextKeys.deopts.groupByFunction, groupDeopts.has(GroupDeopts.ByFunction)),
                setContext(contextKeys.deopts.groupByKind, groupDeopts.has(GroupDeopts.ByKind)),
            ]);
            emitters.didGroupDeoptsChange(value);
        }
    }
}

export async function setSortMaps(value: MapSortMode) {
    if (sortMaps !== value) {
        if (currentContext) {
            emitters.willSortMapsChange();
        }
        sortMaps = value;
        if (currentContext) {
            await Promise.all([
                storage.setSortMaps(value),
                setContext(contextKeys.sortMaps, value)
            ]);
            emitters.didSortMapsChange(value);
        }
    }
}

export async function setGroupMaps(value: ImmutableEnumSet<GroupMaps>) {
    if (!groupMaps.equals(value)) {
        if (currentContext) {
            emitters.willGroupMapsChange();
        }
        groupMaps = value;
        if (currentContext) {
            await Promise.all([
                storage.setGroupMaps(value),
                setContext(contextKeys.maps.groupByFile, groupMaps.has(GroupMaps.ByFile)),
                setContext(contextKeys.maps.groupByFunction, groupMaps.has(GroupMaps.ByFunction)),
            ]);
            emitters.didGroupMapsChange(value);
        }
    }
}

export async function setShowMaps(value: ImmutableEnumSet<ShowMaps>) {
    if (!showMaps.equals(value)) {
        if (currentContext) {
            emitters.willShowMapsChange();
        }
        showMaps = value;
        if (currentContext) {
            await Promise.all([
                storage.setShowMaps(value),
                setContext(contextKeys.maps.showUnreferenced, showMaps.has(ShowMaps.Unreferenced)),
                setContext(contextKeys.maps.showNonUserCode, showMaps.has(ShowMaps.NonUserCode)),
                setContext(contextKeys.maps.showTransitions, showMaps.has(ShowMaps.Transitions)),
            ]);
            emitters.didShowMapsChange(value);
        }
    }
}

export async function setSortProfile(value: ProfileSortMode) {
    if (sortProfile !== value) {
        if (currentContext) {
            emitters.willSortProfileChange();
        }
        sortProfile = value;
        if (currentContext) {
            await setContext(contextKeys.sortProfile, value);
            emitters.didSortProfileChange(value);
        }
    }
}

export async function setShowProfile(value: ProfileShowMode) {
    if (showProfile !== value) {
        if (currentContext) {
            emitters.willShowProfileChange();
        }
        showProfile = value;
        if (currentContext) {
            await setContext(contextKeys.showProfile, value);
            emitters.didShowProfileChange(value);
        }
    }
}

export async function setShowProfileJustMyCode(value: boolean) {
    if (showJustMyCode !== value) {
        if (currentContext) {
            emitters.willShowProfileJustMyCodeChange();
        }
        showJustMyCode = value;
        if (currentContext) {
            await Promise.all([
                storage.setShowJustMyCode(value),
                setContext(contextKeys.showProfileJustMyCode, value)
            ]);
            emitters.didShowProfileJustMyCodeChange(value);
        }
    }
}

export async function setShowNativeCodeProfileNodes(value: boolean) {
    if (showNativeCodeProfileNodes !== value) {
        if (currentContext) {
            emitters.willShowNativeCodeProfileNodesChange();
        }
        showNativeCodeProfileNodes = value;
        if (currentContext) {
            await setContext(contextKeys.showNativeCodeProfileNodes, value);
            emitters.didShowNativeCodeProfileNodesChange(value);
        }
    }
}

export async function setShowNodeJsProfileNodes(value: boolean) {
    if (showNodeJsProfileNodes !== value) {
        if (currentContext) {
            emitters.willShowNodeJsProfileNodesChange();
        }
        showNodeJsProfileNodes = value;
        if (currentContext) {
            await setContext(contextKeys.showNodeJsProfileNodes, value);
            emitters.didShowNodeJsProfileNodesChange(value);
        }
    }
}

export async function setShowNodeModulesProfileNodes(value: boolean) {
    if (showNodeModulesProfileNodes !== value) {
        if (currentContext) {
            emitters.willShowNodeModulesProfileNodesChange();
        }
        showNodeModulesProfileNodes = value;
        if (currentContext) {
            await setContext(contextKeys.showNodeModulesProfileNodes, value);
            emitters.didShowNodeModulesProfileNodesChange(value);
        }
    }
}

export async function setShowDecorations(value: ImmutableEnumSet<ShowDecorations>) {
    if (!showDecorations.equals(value)) {
        if (currentContext) {
            emitters.willShowDecorationsChange();
        }
        showDecorations = value;
        if (currentContext) {
            await Promise.all([
                setContext(contextKeys.decorations.showDeopts, showDecorations.has(ShowDecorations.Deopts)),
                setContext(contextKeys.decorations.showICs, showDecorations.has(ShowDecorations.ICs)),
                setContext(contextKeys.decorations.showFunctionState, showDecorations.has(ShowDecorations.Functions)),
                setContext(contextKeys.decorations.showProfiler, showDecorations.has(ShowDecorations.Profiler)),
                setContext(contextKeys.decorations.showLineTicks, showDecorations.has(ShowDecorations.LineTicks)),
            ]);
            emitters.didShowDecorationsChange(value);
        }
    }
}

export async function setShowLineTicks(value: boolean) {
    if (showLineTicks !== value) {
        if (currentContext) {
            emitters.willShowLineTicksChange();
        }
        showLineTicks = value;
        if (currentContext) {
            await setContext(contextKeys.showLineTicks, value);
            emitters.didShowLineTicksChange(value);
        }
    }
}

export async function activateContextService(context: ExtensionContext) {
    currentContext = context;
    showJustMyCode = storage.getShowJustMyCode();
    showNativeCodeProfileNodes = storage.getShowNativeCodeProfileNodes();
    showNodeJsProfileNodes = storage.getShowNodeJsProfileNodes();
    showNodeModulesProfileNodes = storage.getShowNodeModulesProfileNodes();
    sortICs = storage.getSortICs();
    showICStates = storage.getShowICStates();
    groupDeopts = storage.getGroupDeopts();
    sortDeopts = storage.getSortDeopts();
    groupMaps = storage.getGroupMaps();
    showMaps = storage.getShowMaps();
    sortMaps = storage.getSortMaps();
    await Promise.all([
        setContext(contextKeys.decorations.showDeopts, showDecorations.has(ShowDecorations.Deopts)),
        setContext(contextKeys.decorations.showICs, showDecorations.has(ShowDecorations.ICs)),
        setContext(contextKeys.decorations.showFunctionState, showDecorations.has(ShowDecorations.Functions)),
        setContext(contextKeys.decorations.showProfiler, showDecorations.has(ShowDecorations.Profiler)),
        setContext(contextKeys.decorations.showLineTicks, showDecorations.has(ShowDecorations.LineTicks)),
        setContext(contextKeys.ics.sort, sortICs),
        setContext(contextKeys.ics.show.states, [...showICStates]),
        setContext(contextKeys.ics.show.state.megamorphic, showICStates.has(ShowICStates.Megamorphic)),
        setContext(contextKeys.ics.show.state.polymorphic, showICStates.has(ShowICStates.Polymorphic)),
        setContext(contextKeys.ics.show.state.monomorphic, showICStates.has(ShowICStates.Monomorphic)),
        setContext(contextKeys.ics.show.state.other, showICStates.has(ShowICStates.Other)),
        setContext(contextKeys.deopts.sort, sortDeopts),
        setContext(contextKeys.deopts.groupByFile, groupDeopts.has(GroupDeopts.ByFile)),
        setContext(contextKeys.deopts.groupByFunction, groupDeopts.has(GroupDeopts.ByFunction)),
        setContext(contextKeys.deopts.groupByKind, groupDeopts.has(GroupDeopts.ByKind)),
        setContext(contextKeys.maps.showUnreferenced, showMaps.has(ShowMaps.Unreferenced)),
        setContext(contextKeys.maps.showNonUserCode, showMaps.has(ShowMaps.NonUserCode)),
        setContext(contextKeys.maps.showTransitions, showMaps.has(ShowMaps.Transitions)),
        setContext(contextKeys.maps.groupByFile, groupMaps.has(GroupMaps.ByFile)),
        setContext(contextKeys.maps.groupByFunction, groupMaps.has(GroupMaps.ByFunction)),
        setContext(contextKeys.logStatus, logStatus),
        setContext(contextKeys.sortMaps, sortMaps),
        setContext(contextKeys.sortProfile, sortProfile),
        setContext(contextKeys.showProfile, showProfile),
        setContext(contextKeys.showProfileJustMyCode, showJustMyCode),
        setContext(contextKeys.showNativeCodeProfileNodes, showNativeCodeProfileNodes),
        setContext(contextKeys.showNodeJsProfileNodes, showNodeJsProfileNodes),
        setContext(contextKeys.showNodeModulesProfileNodes, showNodeModulesProfileNodes),
        setContext(contextKeys.showLineTicks, showLineTicks),
    ]);
    return new Disposable(() => {
        logStatus = kDefaultLogStatus;
        sortICs = kDefaultSortICs;
        showICStates = kDefaultShowICStates;
        sortDeopts = kDefaultSortDeopts;
        groupDeopts = kDefaultGroupDeopts;
        sortMaps = kDefaultMapSortMode;
        groupMaps = kDefaultGroupMaps;
        showMaps = kDefaultShowMaps;
        sortMaps = kDefaultMapSortMode;
        sortProfile = kDefaultProfileSortMode;
        showProfile = kDefaultProfileShowMode;
        showJustMyCode = kDefaultShowJustMyCode;
        showNativeCodeProfileNodes = kDefaultShowNativeCodeProfileNodes;
        showNodeJsProfileNodes = kDefaultShowNodeJsProfileNodes;
        showNodeModulesProfileNodes = kDefaultShowNodeModulesProfileNodes;
        showDecorations = kDefaultShowDecorations;
        showLineTicks = kDefaultShowLineTicks;
        currentContext = undefined;
    });
}
