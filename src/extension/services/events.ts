// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ImmutableEnumSet } from "#core/collections/enumSet.js";
import { Disposable, EventEmitter, ExtensionContext, Uri } from "vscode";
import { GroupDeopts, GroupMaps, LogStatus, MapSortMode, ProfileShowMode, ProfileSortMode, ShowDecorations, ShowICStates, ShowMaps, SortDeopts, SortICs } from "../constants";
import { LogFile } from "../model/logFile";
import { ProfileViewNodeSnapshot } from "../model/profileViewNodeSnapshot";

export let events!: ReturnType<typeof createEvents>["events"];
export let emitters!: ReturnType<typeof createEvents>["emitters"];

function createEvents() {
    return EVENTMAP({
        // Lifecycle:

        willOpenLogFile: new EventEmitter<{ uri: Uri }>(),
        didOpenLogFile: new EventEmitter<{ uri: Uri, log: LogFile }>(),
        didFailOpenLogFile: new EventEmitter<void>(),
        willCloseLogFile: new EventEmitter<{ uri: Uri }>(),
        didCloseLogFile: new EventEmitter<{ uri: Uri }>(),
        willReviseLogFile: new EventEmitter<{ uri: Uri }>(),
        didReviseLogFile: new EventEmitter<{ uri: Uri, log: LogFile }>(),

        // Tree Views and Navigation:
        // didShowLineTicks: new EventEmitter<{ node: ProfileViewNode, lineTicks: readonly FileLineTick[] }>(),
        // didHideLineTicks: new EventEmitter<void>(),
        // willRevealMap: new EventEmitter<{ address: number }>(),
        willChangeRecentLogs: new EventEmitter<void>(),
        didChangeRecentLogs: new EventEmitter<void>(),

        // State:
        //
        // See also:
        //  ~/src/services/stateManager.ts

        willChangeCurrentProfileViewNodeSnapshot: new EventEmitter<ProfileViewNodeSnapshot | undefined>(),
        didChangeCurrentProfileViewNodeSnapshot: new EventEmitter<ProfileViewNodeSnapshot | undefined>(),

        // View context:
        //
        // See also:
        //  ~/src/services/context.ts
        //  ~/src/constants.ts

        willLogStatusChange: new EventEmitter<void>(),
        didLogStatusChange: new EventEmitter<LogStatus>(),
        willShowDecorationsChange: new EventEmitter<void>(),
        didShowDecorationsChange: new EventEmitter<ImmutableEnumSet<ShowDecorations>>(),
        willSortDeoptsChange: new EventEmitter<void>(),
        didSortDeoptsChange: new EventEmitter<SortDeopts>(),
        willGroupDeoptsChange: new EventEmitter<void>(),
        didGroupDeoptsChange: new EventEmitter<ImmutableEnumSet<GroupDeopts>>(),
        willSortICsChange: new EventEmitter<void>(),
        didSortICsChange: new EventEmitter<SortICs>(),
        willShowICStatesChange: new EventEmitter<void>(),
        didShowICStatesChange: new EventEmitter<ImmutableEnumSet<ShowICStates>>(),
        willShowMapsChange: new EventEmitter<void>(),
        didShowMapsChange: new EventEmitter<ImmutableEnumSet<ShowMaps>>(),
        willSortMapsChange: new EventEmitter<void>(),
        didSortMapsChange: new EventEmitter<MapSortMode>(),
        willGroupMapsChange: new EventEmitter<void>(),
        didGroupMapsChange: new EventEmitter<ImmutableEnumSet<GroupMaps>>(),
        willShowProfileChange: new EventEmitter<void>(),
        didShowProfileChange: new EventEmitter<ProfileShowMode>(),
        willSortProfileChange: new EventEmitter<void>(),
        didSortProfileChange: new EventEmitter<ProfileSortMode>(),
        willShowProfileJustMyCodeChange: new EventEmitter<void>(),
        didShowProfileJustMyCodeChange: new EventEmitter<boolean>(),
        willShowNativeCodeProfileNodesChange: new EventEmitter<void>(),
        didShowNativeCodeProfileNodesChange: new EventEmitter<boolean>(),
        willShowNodeJsProfileNodesChange: new EventEmitter<void>(),
        didShowNodeJsProfileNodesChange: new EventEmitter<boolean>(),
        willShowNodeModulesProfileNodesChange: new EventEmitter<void>(),
        didShowNodeModulesProfileNodesChange: new EventEmitter<boolean>(),
        willShowLineTicksChange: new EventEmitter<void>(),
        didShowLineTicksChange: new EventEmitter<boolean>(),
    });
}

export function activateEventsService(context: ExtensionContext) {
    const obj = createEvents();
    events = obj.events;
    emitters = obj.emitters;
    return obj.disposable;
}

type EVENTMAP<A extends Record<string, EventEmitter<any>>> = {
    events: { [P in Extract<keyof A, string> as `on${Capitalize<P>}`]: A[P]["event"] };
    emitters: { [P in Extract<keyof A, string>]: A[P]["fire"] };
    disposable: Disposable;
};

function EVENTMAP<A extends Record<string, EventEmitter<any>>>(map: A): EVENTMAP<A> {
    const events: Record<string, EventEmitter<any>["event"]> = {};
    const emitters: Record<string, EventEmitter<any>["fire"]> = {};
    const disposables: Disposable[] = [];
    for (const [key, emitter] of Object.entries(map)) {
        events[`on${key.slice(0, 1).toUpperCase()}${key.slice(1)}`] = emitter.event;
        emitters[key] = emitter.fire.bind(emitter);
        disposables.push(emitter);
    }
    return {
        events: events as EVENTMAP<A>["events"],
        emitters: emitters as EVENTMAP<A>["emitters"],
        disposable: Disposable.from(...disposables)
    };
}
