// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ImmutableEnumSet } from "#core/collections/enumSet.js";

export const extensionName = "deoptexplorer";
export const extensionUIName = "Deopt Explorer";
export const supportedLanguages: readonly string[] = ["javascript", "javascriptreact", "typescript", "typescriptreact"];
export const debuggerType = extensionName;

export namespace commands {
    export const cancel = `${extensionName}.cancel` as const;

    export namespace log {
        const log = `${extensionName}.log` as const;
        export const open = `${log}.open` as const;
        export const reload = `${log}.reload` as const;
        export const close = `${log}.close` as const;
        export const showReport = `${log}.showReport` as const;
        export const clearRecent = `${log}.clearRecent` as const;
        export const removeRecent = `${log}.removeRecent` as const;
    }

    export namespace functions {
        const functions = `${extensionName}.functions` as const;
        export const showFunctionHistory = `${functions}.showFunctionHistory` as const;
    }

    export namespace ics {
        const ics = `${extensionName}.ics` as const;
        export const sortByLocation = `${ics}.sortByLocation` as const;
        export const sortByState = `${ics}.sortByState` as const;

        export const showStateMegamorphic = `${ics}.showStateMegamorphic` as const;
        export const showStatePolymorphic = `${ics}.showStatePolymorphic` as const;
        export const showStateMonomorphic = `${ics}.showStateMonomorphic` as const;
        export const showStateOther = `${ics}.showStateOther` as const;

        // export const showTypeLoadGlobalIC = `${ics}.showTypeLoadGlobalIC` as const;
        // export const showTypeStoreGlobalIC = `${ics}.showTypeStoreGlobalIC` as const;
        // export const showTypeLoadIC = `${ics}.showTypeLoadIC` as const;
        // export const showTypeStoreIC = `${ics}.showTypeStoreIC` as const;
        // export const showTypeKeyedLoadIC = `${ics}.showTypeKeyedLoadIC` as const;
        // export const showTypeKeyedStoreIC = `${ics}.showTypeKeyedStoreIC` as const;
        // export const showTypeStoreInArrayLiteralIC = `${ics}.showTypeStoreInArrayLiteralIC` as const;

        export const hideStateMegamorphic = `${ics}.hideStateMegamorphic` as const;
        export const hideStatePolymorphic = `${ics}.hideStatePolymorphic` as const;
        export const hideStateMonomorphic = `${ics}.hideStateMonomorphic` as const;
        export const hideStateOther = `${ics}.hideStateOther` as const;

        // export const hideTypeLoadGlobalIC = `${ics}.hideTypeLoadGlobalIC` as const;
        // export const hideTypeStoreGlobalIC = `${ics}.hideTypeStoreGlobalIC` as const;
        // export const hideTypeLoadIC = `${ics}.hideTypeLoadIC` as const;
        // export const hideTypeStoreIC = `${ics}.hideTypeStoreIC` as const;
        // export const hideTypeKeyedLoadIC = `${ics}.hideTypeKeyedLoadIC` as const;
        // export const hideTypeKeyedStoreIC = `${ics}.hideTypeKeyedStoreIC` as const;
        // export const hideTypeStoreInArrayLiteralIC = `${ics}.hideTypeStoreInArrayLiteralIC` as const;
    }

    export namespace deopts {
        const deopts = `${extensionName}.deopts` as const;
        export const sortByLocation = `${deopts}.sortByLocation` as const;
        export const sortByKind = `${deopts}.sortByKind` as const;
        export const sortByCount = `${deopts}.sortByCount` as const;
        export const groupByFile = `${deopts}.groupByFile` as const;
        export const groupByFunction = `${deopts}.groupByFunction` as const;
        export const groupByKind = `${deopts}.groupByKind` as const;
        export const ungroupByFile = `${deopts}.ungroupByFile` as const;
        export const ungroupByFunction = `${deopts}.ungroupByFunction` as const;
        export const ungroupByKind = `${deopts}.ungroupByKind` as const;
    }

    export namespace maps {
        const maps = `${extensionName}.maps` as const;
        export const sortByName = `${maps}.sortByName` as const;
        export const sortByCount = `${maps}.sortByCount` as const;
        export const showUnreferenced = `${maps}.showUnreferenced` as const;
        export const hideUnreferenced = `${maps}.hideUnreferenced` as const;
        export const showNonUserCode = `${maps}.showNonUserCode` as const;
        export const hideNonUserCode = `${maps}.hideNonUserCode` as const;
        export const showTransitions = `${maps}.showTransitions` as const;
        export const hideTransitions = `${maps}.hideTransitions` as const;
        export const groupByFile = `${maps}.groupByFile` as const;
        export const groupByFunction = `${maps}.groupByFunction` as const;
        export const ungroupByFile = `${maps}.ungroupByFile` as const;
        export const ungroupByFunction = `${maps}.ungroupByFunction` as const;
        export const showMap = `${maps}.showMap` as const;
    }

    export namespace profile {
        const profile = `${extensionName}.profile` as const;
        export const exportProfile = `${profile}.exportProfile` as const;
        export const sortBySelfTime = `${profile}.sortBySelfTime` as const;
        export const sortByTotalTime = `${profile}.sortByTotalTime` as const;
        export const sortByName = `${profile}.sortByName` as const;
        export const showCallTree = `${profile}.showCallTree` as const;
        export const showBottomUp = `${profile}.showBottomUp` as const;
        export const showFlat = `${profile}.showFlat` as const;
        export const enableJustMyCode = `${profile}.enableJustMyCode` as const;
        export const disableJustMyCode = `${profile}.disableJustMyCode` as const;
        export const showNativeCode = `${profile}.showNativeCode` as const;
        export const hideNativeCode = `${profile}.hideNativeCode` as const;
        export const showNodeJs = `${profile}.showNodeJs` as const;
        export const hideNodeJs = `${profile}.hideNodeJs` as const;
        export const showNodeModules = `${profile}.showNodeModules` as const;
        export const hideNodeModules = `${profile}.hideNodeModules` as const;
        export const showLineTickDecorationsForNode = `${profile}.showLineTickDecorationsForNode` as const;
        export const hideLineTicks = `${profile}.hideLineTicks` as const;
    }

    export namespace decorations {
        const decorations = `${extensionName}.decorations` as const;
        export const showDeopts = `${decorations}.showDeopts` as const;
        export const hideDeopts = `${decorations}.hideDeopts` as const;
        export const showICs = `${decorations}.showICs` as const;
        export const hideICs = `${decorations}.hideICs` as const;
        export const showFunctionStates = `${decorations}.showFunctionStates` as const;
        export const hideFunctionStates = `${decorations}.hideFunctionStates` as const;
        export const showProfiler = `${decorations}.showProfiler` as const;
        export const hideProfiler = `${decorations}.hideProfiler` as const;
        export const showLineTicks = `${decorations}.showLineTicks` as const;
        export const hideLineTicks = `${decorations}.hideLineTicks` as const;
        export const hideAll = `${decorations}.hideAll` as const;
    }
}

export namespace viewsContainers {
    export const container = `${extensionName}-container` as const;
}

export namespace treeviews {
    export const pick = `${extensionName}.pick` as const;
    export const log = `${extensionName}.log` as const;
    export const files = `${extensionName}.files` as const;
    export const ics = `${extensionName}.ics` as const;
    export const deopts = `${extensionName}.deopts` as const;
    export const functions = `${extensionName}.functions` as const;
    export const maps = `${extensionName}.maps` as const;
    export const profile = `${extensionName}.profile` as const;
    export const lineTicks = `${extensionName}.lineTicks` as const;
}

export namespace webviews {
    export const logOverviewView = `${extensionName}.logOverviewView` as const;
    export const reportView = `${extensionName}.reportView` as const;
    export const functionView = `${extensionName}.functionView` as const;
}

export namespace contextKeys {
    export const logStatus = `${extensionName}.logStatus` as const;
    export const sortMaps = `${extensionName}.sortMaps` as const;
    export const sortProfile = `${extensionName}.sortProfile` as const;
    export const showProfile = `${extensionName}.showProfile` as const;
    export const showProfileJustMyCode = `${extensionName}.showProfileJustMyCode` as const;
    export const showNativeCodeProfileNodes = `${extensionName}.showNativeCodeProfileNodes` as const;
    export const showNodeJsProfileNodes = `${extensionName}.showNodeJsProfileNodes` as const;
    export const showNodeModulesProfileNodes = `${extensionName}.showNodeModulesProfileNodes` as const;
    export const showLineTicks = `${extensionName}.showLineTicks` as const;

    export namespace ICState {
        const ICState = `${extensionName}.ICState`;
        export const MEGAMORPHIC = `${ICState}.MEGAMORPHIC`;
    }

    export namespace decorations {
        const decorations = `${extensionName}.decorations`;
        export const showDeopts = `${decorations}.showDeopts` as const;
        export const showICs = `${decorations}.showICs` as const;
        export const showFunctionState = `${decorations}.showFunctionState` as const;
        export const showProfiler = `${decorations}.showProfiler` as const;
        export const showLineTicks = `${decorations}.showLineTicks` as const;
    }

    export namespace ics {
        const ics = `${extensionName}.ics` as const;

        export const sort = `${ics}.sort` as const;

        export namespace show {
            const show = `${ics}.show` as const;

            export const states = `${show}.states` as const;

            export namespace state {
                const state = `${show}.state` as const;

                export const megamorphic = `${state}.megamorphic` as const;
                export const polymorphic = `${state}.polymorphic` as const;
                export const monomorphic = `${state}.monomorphic` as const;
                export const other = `${state}.other` as const;
            }

            // export namespace type {
            //     const type = `${show}.type` as const;
            //
            //     export const LoadGlobalIC = `${type}.LoadGlobalIC` as const;
            //     export const StoreGlobalIC = `${type}.StoreGlobalIC` as const;
            //     export const LoadIC = `${type}.LoadIC` as const;
            //     export const StoreIC = `${type}.StoreIC` as const;
            //     export const KeyedLoadIC = `${type}.KeyedLoadIC` as const;
            //     export const KeyedStoreIC = `${type}.KeyedStoreIC` as const;
            //     export const StoreInArrayLiteralIC = `${type}.StoreInArrayLiteralIC` as const;
            // }
        }
    }
    export namespace deopts {
        const deopts = `${extensionName}.deopts` as const;
        export const sort = `${deopts}.sort` as const;
        export const groupByFile = `${deopts}.groupByFile` as const;
        export const groupByFunction = `${deopts}.groupByFunction` as const;
        export const groupByKind = `${deopts}.groupByKind` as const;
    }
    export namespace maps {
        const maps = `${extensionName}.maps`;
        export const showUnreferenced = `${maps}.showUnreferenced` as const;
        export const showNonUserCode = `${maps}.showNonUserCode` as const;
        export const showTransitions = `${maps}.showTransitions` as const;

        export const groupByFile = `${maps}.groupByFile` as const;
        export const groupByFunction = `${maps}.groupByFunction` as const;
    }
}

export const kDefaultLogStatus = LogStatus.Closed;
export const kDefaultSortICs = SortICs.ByLocation;
export const kDefaultShowICStates = new ImmutableEnumSet([ShowICStates.Megamorphic, ShowICStates.Polymorphic, ShowICStates.Monomorphic, ShowICStates.Other]);
// export const kDefaultShowICTypes = new ImmutableEnumSet([ShowICTypes.LoadGlobalIC, ShowICTypes.StoreGlobalIC, ShowICTypes.LoadIC, ShowICTypes.StoreIC, ShowICTypes.KeyedLoadIC, ShowICTypes.KeyedStoreIC, ShowICTypes.StoreInArrayLiteralIC]);
export const kDefaultGroupDeopts = new ImmutableEnumSet([GroupDeopts.ByFile, GroupDeopts.ByFunction, GroupDeopts.ByKind]);
export const kDefaultSortDeopts = SortDeopts.ByLocation;
export const kDefaultMapSortMode = MapSortMode.ByCount;
export const kDefaultGroupMaps = new ImmutableEnumSet<GroupMaps>();
export const kDefaultProfileSortMode = ProfileSortMode.BySelfTime;
export const kDefaultProfileShowMode = ProfileShowMode.BottomUp;
export const kDefaultShowMaps = new ImmutableEnumSet<ShowMaps>();
export const kDefaultShowJustMyCode = true;
export const kDefaultShowNativeCodeProfileNodes = true;
export const kDefaultShowNodeJsProfileNodes = true;
export const kDefaultShowNodeModulesProfileNodes = true;
export const kDefaultShowDecorations = new ImmutableEnumSet<ShowDecorations>([ShowDecorations.Deopts, ShowDecorations.ICs]);
export const kDefaultShowLineTicks = false;

export const enum LogStatus {
    Closed = "closed",
    Opening = "opening",
    Open = "open"
}

export const enum SortICs {
    ByLocation = "by-location",
    ByState = "by-state",
    // TODO: ByType = "by-type",
    // TODO: ByCount = "by-count",
}

export const enum ShowICStates {
    Megamorphic = "megamorphic",
    Polymorphic = "polymorphic",
    Monomorphic = "monomorphic",
    Other = "other",
}

export const kCountShowICStates = 4;

// export const enum ShowICTypes {
//     LoadGlobalIC = "LoadGlobalIC",
//     StoreGlobalIC = "StoreGlobalIC",
//     LoadIC = "LoadIC",
//     StoreIC = "StoreIC",
//     KeyedLoadIC = "KeyedLoadIC",
//     KeyedStoreIC = "KeyedStoreIC",
//     StoreInArrayLiteralIC = "StoreInArrayLiteralIC",
// }

export const enum SortDeopts {
    ByLocation = "by-location",
    ByKind = "by-kind",
    ByCount = "by-count",
}

export const enum GroupDeopts {
    ByFile = "by-file",
    ByFunction = "by-function",
    ByKind = "by-kind",
}

export const enum MapSortMode {
    ByName = "by-name",
    ByCount = "by-count",
}

export const enum GroupMaps {
    ByFunction = "by-function",
    ByFile = "by-file",
}

export const enum ShowMaps {
    Unreferenced = "unreferenced",
    NonUserCode = "non-user-code",
    Transitions = "transitions",
}

export const kCountShowMaps = 3;

export const enum ProfileSortMode {
    BySelfTime = "by-self-time",
    ByTotalTime = "by-total-time",
    ByName = "by-name",
}

export const enum ProfileShowMode {
    BottomUp = "bottom-up",
    CallTree = "call-tree",
    Flat = "flat",
}

export const enum ShowDecorations {
    Deopts = "deopts",
    ICs = "ics",
    Functions = "functions",
    Profiler = "profiler",
    LineTicks = "line-ticks",
}

export namespace schemes {
    export const map = `${extensionName}+map` as const;
    export const functionHistory = `${extensionName}+function` as const;
    export const profileNode = `${extensionName}+profilenode` as const;
    export const source = `${extensionName}+source` as const;
    export const unknown = `unknown` as const;
}

export namespace storage {
    export const recentFiles = `${extensionName}.recentFiles` as const;
    export const showJustMyCode = `${extensionName}.showJustMyCode` as const;
    export const showNativeCodeProfileNodes = `${extensionName}.showNativeCodeProfileNodes` as const;
    export const showNodeJsProfileNodes = `${extensionName}.showNodeJsProfileNodes` as const;
    export const showNodeModulesProfileNodes = `${extensionName}.showNodeModulesProfileNodes` as const;
    export const sortICs = `${extensionName}.sortICs` as const;
    export const showICStates = `${extensionName}.showICStates` as const;
    export const sortDeopts = `${extensionName}.sortDeopts` as const;
    export const groupMaps = `${extensionName}.groupMaps` as const;
    export const showMaps = `${extensionName}.showMaps` as const;
    export const sortMaps = `${extensionName}.sortMaps` as const;
    export const groupDeopts = `${extensionName}.groupDeopts` as const;
}

export namespace colors {
    function makeHighlightColors<K extends string>(name: K) {
        return {
            background: `${extensionName}.${name}.background`,
            border: `${extensionName}.${name}.border`,
            overviewRuler: `${extensionName}.${name}.overviewRuler`,
        } as const;
    }
    function makeForegroundColor<K extends string>(name: K) {
        return {
            foreground: `${extensionName}.${name}.foreground`
        } as const;
    }
    export const noFeedbackIc = makeHighlightColors("noFeedbackIc");
    export const uninitializedIc = makeHighlightColors("uninitializedIc");
    export const premonomorphicIc = makeHighlightColors("premonomorphicIc");
    export const monomorphicIc = makeHighlightColors("monomorphicIc");
    export const polymorphicIc = makeHighlightColors("polymorphicIc");
    export const recomputeHandlerIc = makeHighlightColors("recomputeHandlerIc");
    export const megamorphicIc = makeHighlightColors("megamorphicIc");
    export const genericIc = makeHighlightColors("genericIc");
    export const softDeopt = makeHighlightColors("softDeopt");
    export const lazyDeopt = makeHighlightColors("lazyDeopt");
    export const eagerDeopt = makeHighlightColors("eagerDeopt");
    export const reoptimizedCode = makeHighlightColors("reoptimizedCode");
    export const compiledCode = makeHighlightColors("compiledCode");
    export const optimizableCode = makeHighlightColors("optimizableCode");
    export const optimizedCode = makeHighlightColors("optimizedCode");
    export const profileHeavy = makeHighlightColors("profileHeavy");
    export const profileModerate = makeHighlightColors("profileModerate");
    export const profileLight = makeHighlightColors("profileLight");
    export const profileMeager = makeHighlightColors("profileMeager");
}

export namespace octicons {
    export const alert = "$(alert)";
    export const check = "$(check)";
    export const circleDash = "$(circle-slash)";
    export const circuitBoard = "$(circuit-board)";
    export const code = "$(code)";
    export const dashboard = "$(dashboard)";
    export const eye = "$(eye)";
    export const flame = "$(flame)";
    export const info = "$(info)";
    export const issueOpened = "$(issue-opened)";
    export const linkExternal = "$(link-external)";
    export const sync = "$(sync)";
    export const syncSpin = "$(sync~spin)";
    export const question = "$(question)";
    export const x = "$(x)";
    export const zap = "$(zap)";
}

export namespace configurationKeys {
    export const dumpbinPath = "dumpbinPath";
    export const includeNatives = "includeNatives";
}