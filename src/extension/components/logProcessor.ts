// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
//
// THIRD PARTY LICENSE NOTICE:
//
// Portions of this code are sourced from V8:
//
//  Copyright 2012 the V8 project authors. All rights reserved.
//  Use of this source code is governed by a BSD-style license that can be
//  found in the LICENSE.v8 file.
//
// Portions of this code are sourced from deoptigate:
//
//  Copyright 2017 Thorsten Lorenz. All rights reserved.
//  Use of this source code is goverened by the license that can be found
//  in the LICENSE.deoptigate file.

import { CancelError } from "@esfx/cancelable";
import { empty, flatMap, identity, map } from "@esfx/iter-fn";
import { from } from "@esfx/iter-query";
import { Address, formatAddress, isAddress, parseAddress, tryParseAddress } from "#core/address.js";
import { assert } from "#core/assert.js";
import { LocationMap } from "#core/collections/locationMap.js";
import { StringMap } from "#core/collections/stringMap.js";
import { StringSet } from "#core/collections/stringSet.js";
import { SourceLocation } from "#core/sourceMap.js";
import { Sources } from "#core/sources.js";
import { TimeDelta, TimeTicks } from "#core/time.js";
import { resolveUri } from "#core/uri.js";
import { V8Version } from "#core/v8Version.js";
import { DeoptEntry, DeoptEntryUpdate } from "#deoptigate/deoptEntry.js";
import { FunctionEntry, FunctionEntryUpdate } from "#deoptigate/functionEntry.js";
import { IcEntry, IcEntryUpdate } from "#deoptigate/icEntry.js";
import { kNullAddress } from "#v8/constants.js";
import { CodeKind, parseCodeKind } from "#v8/enums/codeKind.js";
import { DeoptimizeKind, parseDeoptimizeKind } from "#v8/enums/deoptimizeKind.js";
import { FunctionState, parseFunctionState } from "#v8/enums/functionState.js";
import { IcState, parseIcState } from "#v8/enums/icState.js";
import { IcType } from "#v8/enums/icType.js";
import { MapEvent, parseMapEvent } from "#v8/enums/mapEvent.js";
import { parseVmState, VmState } from "#v8/enums/vmState.js";
import { TickSample } from "#v8/tickSample.js";
import { CodeEntry, DynamicCodeEntry, SharedFunctionCodeEntry } from "#v8/tools/codeentry.js";
import { CodeMap } from "#v8/tools/codemap.js";
import { ConsArray } from "#v8/tools/consarray.js";
import { CppEntriesProvider, getCppEntriesProvider } from "#v8/tools/cppEntriesProvider.js";
import { cancelTokenArg, commandNameArg, parseInt32, Parser, Parsers, parseString, parseVarArgs } from "#v8/tools/logreader.js";
import { Profile } from "#v8/tools/profile.js";
import { SplayTree } from "#v8/tools/splaytree.js";
import { CancellationError, CancellationToken, Location, Position, Progress, Uri } from "vscode";
import { DeoptPosition } from "../model/deoptPosition";
import { Entry } from "../model/entry";
import { FileEntry } from "../model/fileEntry";
import { LogFile } from "../model/logFile";
import { MapEntry, MapEntryUpdate, MapId, MapProperty, MapReference, MapReferencedByIcEntryUpdate, MapReferencedByMap, MapReferencedByMapProperty, PropertyNameEqualer, SymbolName } from "../model/mapEntry";
import { MemoryCategory } from "../model/memoryCategory";
import { MemoryEntry } from "../model/memoryEntry";
import { MemoryOverview } from "../model/memoryOverview";
import { log, measureAsync, measureSync, output, warn } from "../outputChannel";
import { getCanonicalUri } from "../services/canonicalPaths";
import { LocationComparer } from "../vscode/location";
import { messageOnlyProgress } from "../vscode/progress";
import { isPathOrUriString, pathOrUriStringToUri } from "../vscode/uri";
import { VersionedLogReader } from "./v8/versionedLogReader";

const constructorRegExp = /\n - constructor: (0x[a-fA-F0-9]+) <JSFunction ([a-zA-Z$_][a-zA-Z$_0-9]*)(?: \(sfi = ([a-fA-F0-9]+)\))?/;
const typeRegExp = /\n - type: (\w+)\r?\n/;
const elementsKindRegExp = /\n - elements kind: (\w+)\r?\n/;
const instanceSizeRegExp = /\n - instance size: (\d+)\r?\n/;
const inobjectPropertiesRegExp = /\n - inobject properties: (\d+)\r?\n/;
const unusedPropertyFieldsRegExp = /\n - unused property fields: (\d+)\r?\n/;
// const mapDetailsMapLineRegExp = /^Map=(?<value>.*)$/;
// const mapDetailsFieldKeyValueRegExp = /^ - (?<key>type|instance size|inobject properties|elements kind|unused property fields|enum length|native context|prototype info|back pointer|prototype_validity cell|instance descriptors(?: \(own\))?|layout descriptor|prototype|constructor|dependent code|construction counter): (?<value>.*)$/;
// const mapDetailsFieldKeyRegExp = /^ - (?<key>deprecated_map|stable_map|migration_target|dictionary_map|named_interceptor|indexed_interceptor|may_have_interesting_symbols|undetectable|callable|constructor|has_prototype_slot(?: \(non-instance prototype\))?|access_check_needed|non-extensible|prototype_map)$/;
// const mapDetailsInstanceDescriptorsFieldRegExp = /^ - (?<key>instance descriptors) (?<own>\(own\) )?#(?<count>): (?<value>.*)$/;
const mapDetailsPropertyLikeRegExp = /^  \[\d+\]:/;
const mapDetailsPropertyRegExp = /^  \[\d+\]: (?:0x)?[a-fA-F0-9]+:? <(?<type>String\[#?\d+\]|Symbol): (?<key>[^>]*)> \((?:const )?(?:data|accessor)(?: field(?: \d+)?(?::(?<mnemonic>\w+))?| descriptor)(?:, p: \d+)?(?:, attrs: \[(?<attrs>[W_][E_][C_])\])?\) @ (?:Any|None|Class\((?<classMapAddress>[a-fA-F0-9]+)\))?/;
const mapDetailsPropertyRegExp2 = /^  \[\d+\]: (?:0x)?[a-fA-F0-9]+:? \[(?<type>[^\]]+)\] in (?<space>\w+): u?#(?<key>(?:(?! \((?:const )?(?:data|accessor)).)*) \((?:const )?(?:data|accessor)(?: field(?: \d+)?(?::(?<mnemonic>\w+))?| descriptor)(?:, p: \d+)?(?:, attrs: \[(?<attrs>[W_][E_][C_])\])?\) @ (?:Any|None|Class\((?<classMapAddress>[a-fA-F0-9]+)\))?/;

const enum CodeType {
    Cpp = 0,
    SharedLib = 1,
}

export interface LogProcessorOptions {
    cppEntriesProvider?: CppEntriesProvider;
    excludeIc?: boolean;
    excludeBytecodes?: boolean;
    excludeBuiltins?: boolean;
    excludeStubs?: boolean;
    excludeNatives?: boolean;
    timedRange?: boolean;
    pairwiseTimedRange?: boolean;
    globalStorageUri?: Uri;
}

export class LogProcessor {
    private _cppEntriesProvider: CppEntriesProvider;
    private _reader: VersionedLogReader;
    private _processed = false;
    private _version = V8Version.MIN;
    private _codeMap = new CodeMap();
    private _sources = new Sources();
    private _profile: Profile;
    private _files = new StringMap<Uri, FileEntry>(uriToString);
    private _entries = new LocationMap<{ function?: FunctionEntry, ic?: IcEntry, deopt?: DeoptEntry }>();
    private _functions = new LocationMap<FunctionEntry>();
    private _ics = new LocationMap<IcEntry>();
    private _deopts = new LocationMap<DeoptEntry>();
    private _maps = new SplayTree<Address, MapEntry[]>();
    private _heapCapacity = 0;
    private _heapAvailable = 0;
    private _memory = new SplayTree<Address, MemoryEntry>();
    private _memorySize = 0;
    private _maxMemorySize = 0;
    private _memorySizes = new Map<string, MemoryCategory>();
    private _entrySizes = new Map<string, MemoryCategory>();;
    private _codeTypes = new Map<string, CodeType>();
    private _lastTimestamp = TimeTicks.Zero;
    private _mapReferences = new Map<MapEntry, Set<IcEntry>>();
    private _seenFiles = new StringSet(uriToString);
    private _generatedPaths = new StringSet(uriToString);
    private _sourcePaths = new StringSet(uriToString);
    private _messageOnlyProgress: Progress<string> | undefined;

    constructor({
        globalStorageUri,
        cppEntriesProvider = getCppEntriesProvider({ globalStorageUri }),
        excludeIc = false,
        excludeBytecodes = false,
        excludeBuiltins = false,
        excludeStubs = false,
        excludeNatives = false,
        timedRange = false,
        pairwiseTimedRange = false,
    }: LogProcessorOptions = { }) {
        this._cppEntriesProvider = cppEntriesProvider;
        this._profile = new Profile({
            codeMap: this._codeMap,
            sources: this._sources,
            excludeIc,
            excludeBytecodes,
            excludeBuiltins,
            excludeStubs,
            excludeNatives,
        });
        this._profile.onError(message => {
            output.error(message);
        });

        const parseTimeTicks = (text: string) => {
            const timestamp = TimeTicks.sinceOrigin(TimeDelta.fromMicroseconds(text));
            if (timestamp.compareTo(this._lastTimestamp) >= 0) this._lastTimestamp = timestamp;
            return timestamp;
        };

        const parseCodeKindForVersion = (text: string): CodeKind => parseCodeKind(text, this._version);
        const parseVmStateForVersion  = (text: string): VmState => parseVmState(text, this._version);

        // The log reader map is mostly derived from https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc
        // In most cases you can find related log events by looking for uses of the MSG_BUILDER() macro in that file.
        //
        // Some events we don't explicitly handle from that file:
        // Logger::StringEvent              // `<name:string>,<:string>`; source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1055
        // Logger::UncheckedStringEvent     // `<name:string>,<:string>`; source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1059
        // Logger::IntPtrTEvent             // `<name:string>,<:intptr_t>`; source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1065
        // Logger::HandleEvent              // `<name:string>,<:address>`; source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1073
        // Logger::ApiSecurityEvent         // `api,check-security`; source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1080
        // Logger::BasicBlockCounterEvent   // `<marker:?>,<name:string>,<block_id:int>,<count:int>`; source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1121
        // Logger::BuiltinHashEvent         // `<marker:?>,<name:string>,<hash:int>`; source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1130
        // Logger::ApiNamedPropertyAccess   // `api,<tag:string>,<class:string>,<property:string>`; source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1151
        // Logger::ApiIndexedPropertyAccess // `api,<tag:string>,<class:string>,<index:int>`; source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1161
        // Logger::ApiObjectAccess          // `api,<tag:string>,<class:string>`; source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1170
        // Logger::ApiEntryCall             // `api,<name:string>`; source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1177
        // Logger::NewEvent                 // `new,<name:string>,<object:address>,<size:int>`; source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1184
        // Logger::DeleteEvent              // `delete,<name:string>,<object:address>`; source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1192
        // Logger::LogCodeDisassemble       // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1307
        // Logger::ResourceEvent            // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1576
        // Logger::SuspectReadEvent         // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1590
        // Logger::FunctionEvent            // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1616
        // Logger::CompilationCacheEvent    // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1641
        // Logger::ScriptEvent              // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1656
        // Logger::ScriptDetails            // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1681
        // Logger::RuntimeCallTimerEvent    // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1730

        // CODE_MOVING_GC
        // event definition: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/code-events.h#L37
        //
        // code-moving-gc

        // SNAPSHOT_CODE_NAME_EVENT
        // event definition: https://github.com/v8/v8/blob/6bbf2dfa5b3bde9a40527268741b739f7d7e4bd0/src/logging/code-events.h#L37
        // event source: https://github.com/v8/v8/blob/6bbf2dfa5b3bde9a40527268741b739f7d7e4bd0/src/logging/log.cc#L1558
        //
        // snapshot-code-name,<pos:int>,<name:string>

        // more...

        this._reader = new VersionedLogReader({
            // 8.6.133:
            // https://github.com/v8/v8/commit/e8d24c66b958edda253d10e7c8e24102d1662e80#diff-3b0c2882b426a3987400fabb70700bdd936049b0bc58ca4cede2c50341faf1b2R1662
            // added timestamp to IC events
            ">=8.6.133": {
                // #region ics

                // event source: https://github.com/v8/v8/blob/6bbf2dfa5b3bde9a40527268741b739f7d7e4bd0/src/logging/log.cc#L1764
                // Logger::ICEvent
                //
                // <type:string>,<pc:Address>,<timestamp:TimeTicks>,<line:int>,<column:int>,<oldState:char>,<newState:char>,<mapAddr:Address>,<key:string>,<modifier:string>,<slowReason:string>
                "LoadGlobalIC": DISPATCHER({
                    parsers: [commandNameArg, parseAddress, parseTimeTicks, parseInt32, parseInt32, parseIcState, parseIcState, parseAddress, parseString, parseString, parseString],
                    processor: this.processIcEvent.bind(this)
                }),
                "StoreGlobalIC": DISPATCHER({
                    parsers: [commandNameArg, parseAddress, parseTimeTicks, parseInt32, parseInt32, parseIcState, parseIcState, parseAddress, parseString, parseString, parseString],
                    processor: this.processIcEvent.bind(this),
                }),
                "LoadIC": DISPATCHER({
                    parsers: [commandNameArg, parseAddress, parseTimeTicks, parseInt32, parseInt32, parseIcState, parseIcState, parseAddress, parseString, parseString, parseString],
                    processor: this.processIcEvent.bind(this),
                }),
                "StoreIC": DISPATCHER({
                    parsers: [commandNameArg, parseAddress, parseTimeTicks, parseInt32, parseInt32, parseIcState, parseIcState, parseAddress, parseString, parseString, parseString],
                    processor: this.processIcEvent.bind(this),
                }),
                "KeyedLoadIC": DISPATCHER({
                    parsers: [commandNameArg, parseAddress, parseTimeTicks, parseInt32, parseInt32, parseIcState, parseIcState, parseAddress, parseString, parseString, parseString],
                    processor: this.processIcEvent.bind(this),
                }),
                "KeyedStoreIC": DISPATCHER({
                    parsers: [commandNameArg, parseAddress, parseTimeTicks, parseInt32, parseInt32, parseIcState, parseIcState, parseAddress, parseString, parseString, parseString],
                    processor: this.processIcEvent.bind(this),
                }),
                "StoreInArrayLiteralIC": DISPATCHER({
                    parsers: [commandNameArg, parseAddress, parseTimeTicks, parseInt32, parseInt32, parseIcState, parseIcState, parseAddress, parseString, parseString, parseString],
                    processor: this.processIcEvent.bind(this),
                }),

                // #endregion ics
            },

            "*": {
                // #region functions

                // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1087
                //
                // shared-library,<name:string>,<start:Address>,<end:Address>,<aslrSlide:int>
                "shared-library": DISPATCHER({
                    parsers: [parseString, parseAddress, parseAddress, parseInt32, cancelTokenArg],
                    processor: this.processSharedLibrary.bind(this),
                }),

                // CODE_CREATION_EVENT
                // event definition: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/code-events.h#L33
                // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1329
                //
                // code-creation,<type:string>,<kind:int>,<timestamp:int64>,<start:Address>,<size:int>,<name:string>,[<funcAddr:Address>,<state:char>]
                "code-creation": DISPATCHER({
                    parsers: [parseString, parseCodeKindForVersion, parseTimeTicks, parseAddress, parseInt32, parseString, { parser: parseAddress, optional: true }, { parser: parseFunctionState, optional: true }],
                    processor: this.processCodeCreation.bind(this)
                }),

                // CODE_MOVE_EVENT
                // event definition: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/code-events.h#L35
                // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1456
                //
                // code-move,<start:Address>,<end:Address>
                "code-move": DISPATCHER({
                    parsers: [parseAddress, parseAddress],
                    processor: this.processCodeMove.bind(this)
                }),

                // CODE_DELETE_EVENT
                // event definition: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/code-events.h#L36
                //
                // code-delete,<start:Address>
                "code-delete": DISPATCHER({
                    parsers: [parseAddress],
                    processor: this.processCodeDelete.bind(this)
                }),

                // CODE_DISABLE_OPT_EVENT
                // event definition: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/code-events.h#L34
                // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1473
                //
                // code-disable-optimization,<name:string>,<reason:string>
                "code-disable-optimization": {
                    parsers: [parseString, parseString],
                    processor: this.processCodeDisableOptimization.bind(this)
                },

                // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1243
                //
                // code-source-info,<addr:Address>,<script:int>,<start:int>,<end:int>,<pos:string>,<inline-pos:string>,<fns:string>
                //
                // where
                //   <addr> is code object address
                //   <script> is script id
                //   <start> is the starting position inside the script
                //   <end> is the end position inside the script
                //   <pos> is source position table encoded in the string,
                //      it is a sequence of C<code-offset>O<script-offset>[I<inlining-id>]
                //      where
                //        <code-offset> is the offset within the code object
                //        <script-offset> is the position within the script
                //        <inlining-id> is the offset in the <inlining> table
                //   <inlining> table is a sequence of strings of the form
                //      F<function-id>O<script-offset>[I<inlining-id>]
                //      where
                //         <function-id> is an index into the <fns> function table
                //   <fns> is the function table encoded as a sequence of strings
                //      S<shared-function-info-address>
                "code-source-info": DISPATCHER({
                    parsers: [parseAddress, parseInt32, parseInt32, parseInt32, parseString, parseString, parseString],
                    processor: this.processCodeSourceInfo.bind(this)
                }),

                // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1699
                //
                // script-source,<script:int>,<url:string>,<source:string>
                "script-source": DISPATCHER({
                    parsers: [parseInt32, parseString, parseString],
                    processor: this.processScriptSource.bind(this)
                }),

                // SHARED_FUNC_MOVE_EVENT
                // event definition: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/code-events.h#L38
                // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1567
                //
                // sfi-move,<from:Address>,<to:Address>
                "sfi-move": DISPATCHER({
                    parsers: [parseAddress, parseAddress],
                    processor: this.processSharedFunctionMove.bind(this)
                }),

                // #endregion functions

                // #region ics

                // event source: https://github.com/v8/v8/blob/443230c20de5825da9c8e477e597353850a1708e/src/logging/log.cc#L1653
                //
                // <type:string>,<pc:Address>,<line:int>,<column:int>,<oldState:char>,<newState:char>,<mapAddr:Address>,<key:string>,<modifier:string>,<slowReason:string>
                "LoadGlobalIC": DISPATCHER({
                    parsers: [parseAddress, parseInt32, parseInt32, parseIcState, parseIcState, parseAddress, parseString, parseString, parseString],
                    processor: this.processIcEventUsingLastTimestamp.bind(this, IcType.LoadGlobalIC)
                }),
                "StoreGlobalIC": DISPATCHER({
                    parsers: [parseAddress, parseInt32, parseInt32, parseIcState, parseIcState, parseAddress, parseString, parseString, parseString],
                    processor: this.processIcEventUsingLastTimestamp.bind(this, IcType.StoreGlobalIC),
                }),
                "LoadIC": DISPATCHER({
                    parsers: [parseAddress, parseInt32, parseInt32, parseIcState, parseIcState, parseAddress, parseString, parseString, parseString],
                    processor: this.processIcEventUsingLastTimestamp.bind(this, IcType.LoadIC),
                }),
                "StoreIC": DISPATCHER({
                    parsers: [parseAddress, parseInt32, parseInt32, parseIcState, parseIcState, parseAddress, parseString, parseString, parseString],
                    processor: this.processIcEventUsingLastTimestamp.bind(this, IcType.StoreIC),
                }),
                "KeyedLoadIC": DISPATCHER({
                    parsers: [parseAddress, parseInt32, parseInt32, parseIcState, parseIcState, parseAddress, parseString, parseString, parseString],
                    processor: this.processIcEventUsingLastTimestamp.bind(this, IcType.KeyedLoadIC),
                }),
                "KeyedStoreIC": DISPATCHER({
                    parsers: [parseAddress, parseInt32, parseInt32, parseIcState, parseIcState, parseAddress, parseString, parseString, parseString],
                    processor: this.processIcEventUsingLastTimestamp.bind(this, IcType.KeyedStoreIC),
                }),
                "StoreInArrayLiteralIC": DISPATCHER({
                    parsers: [parseAddress, parseInt32, parseInt32, parseIcState, parseIcState, parseAddress, parseString, parseString, parseString],
                    processor: this.processIcEventUsingLastTimestamp.bind(this, IcType.StoreInArrayLiteralIC),
                }),

                // #endregion ics

                // #region deopts

                // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1484
                //
                // code-deopt,<timestamp:TimeTicks>,<size:int>,<pc:Address>,<inliningId:int>,<scriptOffset:int>,<bailoutType:DeoptimizeKind>,<sourcePositionText:string>,<deoptReason:string>
                "code-deopt": DISPATCHER({
                    parsers: [parseTimeTicks, parseInt32, parseAddress, parseInt32, parseInt32, parseDeoptimizeKind, DeoptPosition.parse, parseString],
                    processor: this.processCodeDeopt.bind(this)
                }),

                // #endregion deopts

                // #region maps

                // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1825
                //
                // map-create,<timestamp:TimeTicks>,<addr:Address>
                "map-create": DISPATCHER({
                    parsers: [parseTimeTicks, parseAddress],
                    processor: this.processMapCreate.bind(this)
                }),

                // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1833
                //
                // map-details,<timestamp:TimeTicks>,<addr:Address>,<details:string>
                "map-details": DISPATCHER({
                    parsers: [parseTimeTicks, parseAddress, parseString],
                    processor: this.processMapDetails.bind(this)
                }),

                // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1793
                //
                // map,<event:string>,<timestamp:TimeTicks>,<from:Address>,<to:Address>,<pc:Address>,<line:int>,<column:int>,<reason:string>,<name:string>
                "map": DISPATCHER({
                    parsers: [parseMapEvent, parseTimeTicks, parseAddress, parseAddress, parseAddress, parseInt32, parseInt32, parseString, parseString],
                    processor: this.processMapEvent.bind(this)
                }),

                // #endregion maps

                // #region profiles

                // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1049
                //
                // profiler,begin,<interval:int>
                // profiler,end
                "profiler": DISPATCHER({
                    parsers: [parseString, { parser: parseInt32, optional: true }],
                    processor: this.processProfilerEvent.bind(this)
                }),

                // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1105
                //
                // timer-event-start,<name:string>,<timestamp:TimeTicks>
                "timer-event-start": DISPATCHER({
                    parsers: [parseString, parseTimeTicks],
                    processor: this.processTimerEventStart.bind(this)
                }),

                // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1105
                //
                // timer-event-start,<name:string>,<timestamp:TimeTicks>
                "timer-event-end": DISPATCHER({
                    parsers: [parseString, parseTimeTicks],
                    processor: this.processTimerEventEnd.bind(this)
                }),

                // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1105
                "timer-event": null,

                // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1098
                //
                // current-time,<timestamp:TimeTicks>
                "current-time": DISPATCHER({
                    parsers: [parseTimeTicks],
                    processor: this.processCurrentTime.bind(this)
                }),

                // TICK_EVENT
                // event definition: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/code-events.h#L40
                // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1741
                //
                // tick,<pc:Address>,<timestamp:TimeTicks>,<isExternalCallback:int>,<tosOrExternalCallback:Address>,<vmState:VmState>,<stack:string[]>
                "tick": DISPATCHER({
                    parsers: [parseAddress, parseTimeTicks, parseInt, parseAddress, parseVmStateForVersion, parseVarArgs],
                    processor: this.processTickEvent.bind(this)
                }),

                // #endregion profiles

                // #region memory
                "heap-capacity": DISPATCHER({
                    parsers: [parseInt],
                    processor: this.processHeapCapacityEvent.bind(this)
                }),
                "heap-available": DISPATCHER({
                    parsers: [parseInt],
                    processor: this.processHeapAvailableEvent.bind(this)
                }),
                "new": DISPATCHER({
                    parsers: [parseString, parseAddress, parseInt],
                    processor: this.processNewEvent.bind(this)
                }),
                "delete": DISPATCHER({
                    parsers: [parseString, parseAddress],
                    processor: this.processDeleteEvent.bind(this)
                }),
                // #endregion memory
            }
        },
        timedRange, pairwiseTimedRange);
        this._reader.onDidVersionChange(version => {
            this._version = version;
            output.log(`Detected log for V8 ${version.toFullString()}`);
        });
        this._reader.onError(message => {
            output.error(message);
        });
    }

    private async processContent(content: string | AsyncIterable<string>, progress: Progress<{ increment?: number, message?: string }>, token: CancellationToken, estimatedLogSize?: number) {
        this._messageOnlyProgress = messageOnlyProgress(progress);
        if (typeof content === "string") {
            const result = this._reader.processLogChunk(content, token);
            if (result) {
                await result;
            }
        }
        else {
            for await (const line of content) {
                assert(!line.includes("\n"));
                const result = this._reader.processLogLine(line, token);
                if (result) {
                    await result;
                }
                if (estimatedLogSize) {
                    progress.report({ increment: (line.length + 1) * 100 / estimatedLogSize, message: "Processing log..." });
                }
            }
        }

        this._profile.finalize();
        this._messageOnlyProgress = undefined;
    }

    /**
     * Processes log content.
     * @param content Either a `string` consisting of the entire file, or an `AsyncIterable<string>` that yields each line of the file.
     * @param progress An object used to report progress.
     * @param token A token used to observe cancellation.
     * @param estimatedLogSize The estimated size of the log.
     * @returns The resulting `LogFile`.
     */
    async process(content: string | AsyncIterable<string>, progress: Progress<{ increment?: number, message?: string }>, token: CancellationToken, estimatedLogSize?: number) {
        if (this._processed) throw new Error("Processing already completed");
        this._processed = true;

        try {
            await measureAsync("processContent", () => this.processContent(content, progress, token, estimatedLogSize));

            progress.report({ message: "Resolving Files..." });

            await measureAsync("resolveFiles", async () => {
                const workQueue = new ConsArray<Uri>();
                workQueue.concat([...this._seenFiles]);

                const resolvedFiles = new StringSet(uriToString);
                for (const file of workQueue.values()) {
                    if (token.isCancellationRequested) throw new CancellationError();
                    if (resolvedFiles.has(file)) continue;
                    resolvedFiles.add(file);

                    // Resolve the file
                    const resolution = this._sources.getExistingResolution(file) ?? await this._sources.resolveAsync(file);
                    if (resolution.result === "skip") continue;

                    // Resolve the source map
                    const sourceMap = this._sources.getExistingSourceMap(file) ?? await this._sources.getSourceMapAsync(file);
                    if (sourceMap === "no-sourcemap") continue;

                    // add the sources of the source map to be processed in the next pass.
                    workQueue.concat(sourceMap.sources);
                }
            });

            measureSync("resolveLocations", () => {
                // Resolve source locations. We must do this in advance to get the correct file information for the UI.
                progress.report({ message: "Resolving locations..." });

                type ResolutionWorkItem =
                    | CodeEntry
                    | FunctionEntry
                    | IcEntry
                    | DeoptEntry
                    | MapEntryUpdate
                    ;

                // // fixup map properties where the source wasn't resolved
                // for (const maps of this._maps.exportValues())
                // for (const map of maps) {
                //     let stringProperties: Map<string, FunctionEntry> | undefined;
                //     let symbolProperties: HashMap<SymbolName, FunctionEntry> | undefined;
                //     for (const property of map.properties) {
                //         if (property.source) continue;
                //         if (!stringProperties || !symbolProperties) {
                //             stringProperties = new Map();
                //             symbolProperties = new HashMap(SymbolNameEqualer);
                //             for (const update of map.updates) {
                //                 if (!update.functionEntry) continue;
                //                 if (typeof update.name === "string") {
                //                     stringProperties.set(update.name, update.functionEntry);
                //                 }
                //                 else {
                //                     symbolProperties.set(update.name, update.functionEntry);
                //                 }
                //             }
                //         }
                //         if (typeof property.name === "string") {
                //             property.source = stringProperties.get(property.name);
                //         }
                //         else {
                //             property.source = symbolProperties.get(property.name);
                //         }
                //     }
                // }

                const workItems: Iterable<ResolutionWorkItem> = from<ResolutionWorkItem>(empty())
                    .concat(this._profile.dynamicCodeEntries())
                    .concat(this._functions.values())
                    .concat(this._ics.values())
                    .concat(this._deopts.values())
                    .concat(flatMap(flatMap(this._maps.exportValues(), identity), map => map.updates));

                for (const entry of workItems) {
                    if (token.isCancellationRequested) throw new CancellationError();
                    if (!entry.filePosition) continue;

                    // resolve the file location
                    const uri = entry.filePosition.uri;
                    const resolution = this._sources.getExistingResolution(uri);
                    assert(resolution, `Should have resolved source file for ${uri.toString()} in an earlier step.`);

                    if (resolution.result === "redirect") {
                        switch (entry.kind) {
                            case "function": this._functions.delete(entry.filePosition); break;
                            case "ic": this._ics.delete(entry.filePosition); break;
                            case "deopt": this._deopts.delete(entry.filePosition); break;
                        }
                        entry.filePosition = new Location(resolution.file, entry.filePosition.range);
                        switch (entry.kind) {
                            case "function": this._functions.set(entry.filePosition, entry); break;
                            case "ic": this._ics.set(entry.filePosition, entry); break;
                            case "deopt": this._deopts.set(entry.filePosition, entry); break;
                        }
                    }

                    if (resolution.result !== "skip") {
                        const sourceMap = this._sources.getExistingSourceMap(uri);
                        assert(sourceMap, "Should have resolved source-map in an earlier step.");
                        if (sourceMap !== "no-sourcemap") {
                            let sourceLocation: Location | undefined = sourceMap.toSourceLocation(entry.filePosition.range.start);
                            if (sourceLocation) {
                                const canonicalUri = getCanonicalUri(sourceLocation.uri);
                                const resolution = this._sources.getExistingResolution(canonicalUri);
                                assert(resolution, "Should have resolved source location in an earlier step");
                                if (resolution.result === "redirect") {
                                    sourceLocation = new Location(resolution.file, sourceLocation.range);
                                }
                                entry.generatedFilePosition = entry.filePosition;
                                entry.filePosition = sourceLocation;
                                switch (entry.kind) {
                                    case "function":
                                    case "ic":
                                    case "deopt":
                                    case "map-update":
                                        if (sourceLocation instanceof SourceLocation && sourceLocation.name && !entry.generatedFunctionName) {
                                            entry.generatedFunctionName = entry.functionName;
                                            entry.functionName = sourceLocation.name;
                                        }
                                        break;
                                }

                                switch (entry.kind) {
                                    case "function": this._functions.set(entry.filePosition, entry); break;
                                    case "ic": this._ics.set(entry.filePosition, entry); break;
                                    case "deopt": this._deopts.set(entry.filePosition, entry); break;
                                }
                            }
                        }
                    }

                    switch (entry.kind) {
                        case "function":
                        case "ic":
                        case "deopt":
                            this.addEntry(entry);
                            break;
                    }

                    if (this._sources.has(entry.filePosition.uri)) {
                        this._sourcePaths.add(entry.filePosition.uri);
                        switch (entry.kind) {
                            case "function": this.getFileEntry(entry.filePosition.uri).functions.push(entry); break;
                            case "ic": this.getFileEntry(entry.filePosition.uri).ics.push(entry); break;
                            case "deopt": this.getFileEntry(entry.filePosition.uri).deopts.push(entry); break;
                        }
                    }

                    if (entry.generatedFilePosition) {
                        if (this._sources.has(entry.generatedFilePosition.uri)) {
                            this._generatedPaths.add(entry.generatedFilePosition.uri);
                            switch (entry.kind) {
                                case "function": this.getFileEntry(entry.generatedFilePosition.uri).functions.push(entry); break;
                                case "ic": this.getFileEntry(entry.generatedFilePosition.uri).ics.push(entry); break;
                                case "deopt": this.getFileEntry(entry.generatedFilePosition.uri).deopts.push(entry); break;
                            }
                        }
                    }
                }
            });

            // Sort entries by reference location
            for (const fileEntry of this._files.values()) {
                fileEntry.functions = from(fileEntry.functions)
                    .orderBy(entry => entry.filePosition, LocationComparer)
                    .distinct()
                    .toArray();
                fileEntry.ics = from(fileEntry.ics)
                    .orderBy(entry => entry.filePosition, LocationComparer)
                    .distinct()
                    .toArray();
                fileEntry.deopts = from(fileEntry.deopts)
                    .orderBy(entry => entry.filePosition, LocationComparer)
                    .distinct()
                    .toArray();
            }

            return new LogFile(
                this._version,
                this._entries,
                this._files,
                new StringMap<MapId, MapEntry>(
                    mapId => mapId.toString(),
                    flatMap(this._maps.exportKeysAndValues(), ([address, maps]) => map(maps, (map, index) => [new MapId(address, index), map] as [MapId, MapEntry]))),
                this._profile,
                new MemoryOverview(
                    this._heapCapacity,
                    this._heapAvailable,
                    this._memorySize,
                    this._maxMemorySize,
                    this._memorySizes,
                    this._entrySizes,
                ),
                this._sourcePaths,
                this._generatedPaths,
                this._sources
            );
        }
        catch (e) {
            if (e instanceof CancellationError ||
                e instanceof CancelError) {
                throw e;
            }
            console.error(e);
            debugger;
            throw e;
        }
    }

    private findFunctionBySfiAddress(address: Address) {
        const func = this._profile.findEntry(address);
        if (func instanceof SharedFunctionCodeEntry) {
            const { filePosition } = func.functionName;
            const entry = filePosition && this._functions.get(filePosition);
            return entry;
        }
    }

    private findFunctionByCodeAddress(address: Address) {
        const code = this._profile.findEntry(address);
        if (code?.isJSFunction?.()) {
            const { filePosition } = code.func.functionName;
            const entry = filePosition && this._functions.get(filePosition);
            return entry;
        }
    }

    private findProfileEntry(pc: Address) {
        const code = this._profile.findEntry(pc);
        if (code?.isJSFunction) {
            return code as DynamicCodeEntry;
        }
    }

    private addEntry(entry: Entry) {
        let entries = this._entries.get(entry.filePosition);
        if (!entries) this._entries.set(entry.filePosition, entries = {});
        (entries[entry.kind] as Entry) = entry;

        if (entry.generatedFilePosition) {
            let entries = this._entries.get(entry.generatedFilePosition);
            if (!entries) this._entries.set(entry.generatedFilePosition, entries = {});
            (entries[entry.kind] as Entry) = entry;
        }
    }

    private getFileEntry(file: Uri) {
        let fileEntry = this._files.get(file);
        if (!fileEntry) this._files.set(file, fileEntry = { functions: [], ics: [], deopts: [] });
        return fileEntry;
    }

    // #region functions

    // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1087
    private async processSharedLibrary(libName: string, startAddress: Address, endAddress: Address, aslrSlide: number, token: CancellationToken | undefined) {
        const entry = this._profile.addLibrary(libName, startAddress, endAddress);
        this._codeTypes.set(entry.getName(), CodeType.SharedLib);
        await this._cppEntriesProvider.parseVmSymbols(libName, startAddress, endAddress, aslrSlide, (name, startAddress, endAddress) => {
            this._profile.addStaticCode(`${name} ${libName}`, startAddress, endAddress);
            this._codeTypes.set(name, CodeType.Cpp);
        }, this._messageOnlyProgress, token);
        this._messageOnlyProgress?.report("Processing log...");

        const size = Number(endAddress - startAddress);
        this.changeMemoryCategorySize(this._entrySizes, "Shared Library Code", size);
    }

    // CODE_CREATION_EVENT
    // event definition: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/code-events.h#L33
    // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1329
    //
    private processCodeCreation(type: string, kind: CodeKind, timestamp: TimeTicks, startAddress: Address, size: number, name: string, funcStartAddress?: Address, state?: FunctionState) {
        // NOTE: Line information collected in https://github.com/v8/v8/blob/6bbf2dfa5b3bde9a40527268741b739f7d7e4bd0/src/profiler/profiler-listener.cc#L115
        if (funcStartAddress !== undefined && state !== undefined) {
            const code = this._profile.addFuncCode(type, name, timestamp, startAddress, size, funcStartAddress, state);
            code.code_kind = kind;

            let entry: FunctionEntry | undefined;
            if (code.functionName.filePosition) {
                entry = this._functions.get(code.functionName.filePosition);
                if (!entry) {
                    entry = new FunctionEntry(this._sources, type, kind, code.functionName.name, code.functionName.filePosition);
                    this._functions.set(code.functionName.filePosition, entry);
                }
                entry.lastSfiAddress = funcStartAddress;
                entry.updates.push(new FunctionEntryUpdate(timestamp, state));
                entry.timeline.push({ event: entry.timeline.length ? "updated" : "created", timestamp, startAddress, funcStartAddress, size, state, codeKind: kind, type });
            }

            if (code.functionName.filePosition) {
                this._seenFiles.add(code.functionName.filePosition.uri);
            }
        }
        else {
            const code = this._profile.addCode(type, name, timestamp, startAddress, size);
            code.code_kind = kind;
            this._codeEntries.push(code);

            if (code.functionName.filePosition) {
                this._seenFiles.add(code.functionName.filePosition.uri);
            }
        }

        this.changeMemoryCategorySize(this._entrySizes, type, size);
    }

    private _codeEntries: DynamicCodeEntry[] = [];

    // CODE_MOVE_EVENT
    // event definition: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/code-events.h#L35
    // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1456
    private processCodeMove(fromAddress: Address, toAddress: Address) {
        const code = this._profile.findEntry(fromAddress);
        if (code?.isJSFunction?.()) {
            const { filePosition } = code.func.functionName;
            const entry = filePosition && this._functions.get(filePosition);
            entry?.timeline.push({ event: "moved", timestamp: this._lastTimestamp, fromAddress, toAddress });
        }
        this._profile.moveCode(fromAddress, toAddress);
    }

    // SHARED_FUNC_MOVE_EVENT
    // event definition: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/code-events.h#L38
    // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1567
    private processSharedFunctionMove(fromAddress: Address, toAddress: Address) {
        const func = this._profile.findEntry(fromAddress);
        if (func instanceof SharedFunctionCodeEntry) {
            const { filePosition } = func.functionName;
            const entry = filePosition && this._functions.get(filePosition);
            if (entry) {
                entry.lastSfiAddress = toAddress;
                entry.timeline.push({ event: "sfi-moved", timestamp: this._lastTimestamp, fromAddress, toAddress });
            }
        }
        this._profile.moveFunc(fromAddress, toAddress);
    }

    // CODE_DELETE_EVENT
    // event definition: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/code-events.h#L36
    private processCodeDelete(startAddress: Address) {
        const code = this._profile.findEntry(startAddress);
        if (code?.isJSFunction?.()) {
            const { filePosition } = code.func.functionName;
            const entry = filePosition && this._functions.get(filePosition);
            if (entry) {
                entry.timeline.push({ event: "deleted", timestamp: this._lastTimestamp, startAddress });
            }
        }
        this._profile.deleteCode(startAddress);

        if (code) {
            this.changeMemoryCategorySize(this._entrySizes, code.type, code.size);
        }
    }

    // CODE_DISABLE_OPT_EVENT
    // event definition: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/code-events.h#L34
    // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1473
    private processCodeDisableOptimization(name: string, reason: string) {
    }

    // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1699
    private processScriptSource(scriptId: number, url: string, source: string) {
        const uri = url ? getCanonicalUri(isPathOrUriString(url) ? pathOrUriStringToUri(url) : resolveUri(Uri.parse("unknown:", /*strict*/ true), url)) : undefined;
        if (uri) {
            this._seenFiles.add(uri);
        }
        this._profile.addScriptSource(scriptId, uri, source);
    }

    // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1243
    //
    // code-source-info,<addr>,<script>,<start>,<end>,<pos>,<inline-pos>,<fns>
    //
    // where
    //   <addr> is code object address
    //   <script> is script id
    //   <start> is the starting position inside the script
    //   <end> is the end position inside the script
    //   <pos> is source position table encoded in the string,
    //      it is a sequence of C<code-offset>O<script-offset>[I<inlining-id>]
    //      where
    //        <code-offset> is the offset within the code object
    //        <script-offset> is the position within the script
    //        <inlining-id> is the offset in the <inlining> table
    //   <inlining> table is a sequence of strings of the form
    //      F<function-id>O<script-offset>[I<inlining-id>]
    //      where
    //         <function-id> is an index into the <fns> function table
    //   <fns> is the function table encoded as a sequence of strings
    //      S<shared-function-info-address>
    private processCodeSourceInfo(startAddress: Address, scriptId: number, startPos: number, endPos: number, sourcePositions: string, inliningPositions: string, inlinedFunctions: string) {
        return this._profile.addSourcePositions(startAddress, scriptId, startPos, endPos, sourcePositions, inliningPositions, inlinedFunctions);
    }

    // #endregion functions

    // #region ics

    private processIcEventUsingLastTimestamp(type: IcType, pc: Address, line: number, column: number, oldState: IcState, newState: IcState, mapAddress: Address, key: string, modifier: string, slowReason: string) {
        return this.processIcEvent(type, pc, this._lastTimestamp, line, column, oldState, newState, mapAddress, key, modifier, slowReason);
    }

    private processIcEvent(type: IcType, pc: Address, timestamp: TimeTicks, line: number, column: number, oldState: IcState, newState: IcState, mapAddress: Address, key: string, modifier: string, slowReason: string) {
        const code = this.findProfileEntry(pc);
        if (code) {
            // Get the name of the function and its file position
            const name = code.functionName.name;
            const codeFilePosition = code.filePosition ?? code.functionName.filePosition;
            if (codeFilePosition) {
                const uri = codeFilePosition.uri;
                const icFilePosition = new Location(uri, new Position(Math.max(0, line - 1), Math.max(0, column - 1)));

                // record an inline cache at this position
                let entry = this._ics.get(icFilePosition);
                if (!entry) {
                    entry = new IcEntry(this._sources, name, icFilePosition);
                    this._ics.set(icFilePosition, entry);
                }

                let mapId = MapId.NONE;
                let map: MapEntry | undefined;
                if (mapAddress !== kNullAddress) {
                    const maps = this._maps.find(mapAddress)?.value;
                    const mapIndex = maps ? maps.length - 1 : 0;
                    map = maps?.[mapIndex];
                    mapId = new MapId(mapAddress, mapIndex);
                }

                const update = new IcEntryUpdate(
                    timestamp,
                    type,
                    oldState,
                    newState,
                    key,
                    mapId,
                    map,
                    code.isJSFunction() ? code.state : undefined
                );
                update.functionEntry = this._functions.get(codeFilePosition);
                entry.updates.push(update);

                if (codeFilePosition) {
                    this._functions.get(codeFilePosition)?.timeline.push({ event: "ic", timestamp, entry, update });
                }

                if (map) {
                    let mapReferences = this._mapReferences.get(map);
                    if (!mapReferences) this._mapReferences.set(map, mapReferences = new Set());
                    if (!mapReferences.has(entry)) {
                        mapReferences.add(entry);
                        map.referencedBy.push(new MapReferencedByIcEntryUpdate(entry, update));
                    }
                }
            }
        }
    }

    // #endregion ics

    // #region deopts

    // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1484
    private processCodeDeopt(timestamp: TimeTicks, size: number, pc: Address, inliningId: number, scriptOffset: number, bailoutType: DeoptimizeKind, deoptPosition: DeoptPosition, deoptReason: string) {
        const code = this.findProfileEntry(pc);
        assert(code);

        const { name, filePosition: codeFilePosition } = code.functionName;
        const filePosition = deoptPosition.filePosition;

        if (codeFilePosition?.uri) {
            this._seenFiles.add(codeFilePosition.uri);
        }

        this._seenFiles.add(filePosition.uri);
        if (deoptPosition.inlinedAt) {
            for (const location of deoptPosition.inlinedAt) {
                this._seenFiles.add(location.uri);
            }
        }

        let entry = this._deopts.get(filePosition);
        if (!entry) {
            entry = new DeoptEntry(this._sources, name, filePosition);
            this._deopts.set(filePosition, entry);
        }

        const update = new DeoptEntryUpdate(
            timestamp,
            bailoutType,
            deoptReason,
            code.isJSFunction() ? code.state : undefined,
            inliningId,
            scriptOffset,
        );
        update.functionEntry = codeFilePosition && this._functions.get(codeFilePosition);
        entry.updates.push(update);

        if (update.functionEntry) {
            update.functionEntry?.timeline.push({ event: "deopt", timestamp, entry, update });
        }
    }

    // #endregion deopts

    // #region maps

    // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1825
    private processMapCreate(timestamp: TimeTicks, startAddress: Address) {
        let maps = this._maps.find(startAddress)?.value;
        if (!maps) this._maps.insert(startAddress, maps = []);
        maps.push(new MapEntry(timestamp));
    }

    // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1833
    private processMapDetails(timestamp: TimeTicks, startAddress: Address, details: string) {
        const maps = this._maps.find(startAddress)?.value;
        assert(maps);

        const map = maps[maps.length - 1];
        map.details = details;

        const constructorMatch = constructorRegExp.exec(details);
        if (constructorMatch) {
            const [, constructorAddressText, constructorName, sfiAddressText] = constructorMatch;
            const sfi = sfiAddressText ? tryParseAddress(sfiAddressText) : undefined;
            if (isAddress(sfi)) {
                map.constructorEntry = this.findFunctionBySfiAddress(sfi);
            }

            if (!map.constructorEntry) {
                const codeAddress = constructorAddressText ? tryParseAddress(constructorAddressText) : undefined;
                if (isAddress(codeAddress)) {
                    map.constructorEntry ??= this.findFunctionByCodeAddress(codeAddress);
                }
            }

            map.constructorName = constructorName;
        }

        map.mapType = typeRegExp.exec(details)?.[1];
        map.elementsKind = elementsKindRegExp.exec(details)?.[1];

        const instanceSize = instanceSizeRegExp.exec(details)?.[1];
        map.instanceSize = instanceSize ? parseInt(instanceSize, 10) : undefined;
        if (map.instanceSize !== undefined) {
            this.changeMemoryCategorySize(this._entrySizes, "Maps", map.instanceSize);
        }

        const inobjectProperties = inobjectPropertiesRegExp.exec(details)?.[1];
        map.inobjectPropertiesCount = inobjectProperties ? parseInt(inobjectProperties, 10) : undefined;

        const unusedPropertyFields = unusedPropertyFieldsRegExp.exec(details)?.[1];
        map.unusedPropertyFields = unusedPropertyFields ? parseInt(unusedPropertyFields, 10) : undefined;

        const detailLines = details.split(/\r?\n/g);
        for (const line of detailLines) {
            if (!mapDetailsPropertyLikeRegExp.test(line)) continue;

            // parse properties
            const match = mapDetailsPropertyRegExp.exec(line)
                ?? mapDetailsPropertyRegExp2.exec(line);
            if (!match?.groups) {
                warn("'map-details' line does not match the expected format:", line);
                continue;
            }

            const { key, type, mnemonic, attrs, classMapAddress } = match.groups;
            const name = type === "Symbol" ? new SymbolName(key) : key;
            let property = map.properties.find(prop => PropertyNameEqualer.equals(prop.name, name));
            if (!property) map.properties.push(property = new MapProperty(name));
            if (attrs) {
                property.writable = attrs.charAt(0) === "W";
                property.enumerable = attrs.charAt(1) === "E";
                property.configurable = attrs.charAt(2) === "C";
            }
            switch (mnemonic) {
                case undefined: break;
                case "v": property.type = "none"; break;
                case "t": property.type = "tagged"; break;
                case "s": property.type = "smi"; break;
                case "d": property.type = "double"; break;
                case "h":
                    if (classMapAddress) {
                        const address = parseAddress(classMapAddress);
                        const maps = this._maps.find(address)?.value;
                        const index = maps ? maps.length - 1 : 0;
                        property.type = new MapId(address, index);
                    }
                    else {
                        property.type = "heap";
                    }
                    break;
                default:
                    output.warn(`Unrecognized mnemonic '${mnemonic}' in map details: '${line}'`);
                    break;
            }
            if (isAddress(property.type)) {
                const targetMaps = this._maps.find(property.type)?.value;
                const targetMap = targetMaps?.[targetMaps.length - 1];
                if (targetMap) {
                    targetMap.referencedBy.push(new MapReferencedByMapProperty(property));
                }
            }
        }
    }

    // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1793
    private processMapEvent(event: MapEvent, timestamp: TimeTicks, fromAddress: Address, toAddress: Address, pc: Address, line: number, column: number, reason: string, nameString: string) {
        const fromMaps = fromAddress !== kNullAddress ? this._maps.find(fromAddress)?.value : undefined;
        const fromIndex = fromMaps ? fromMaps.length - 1 : 0;
        const fromId = new MapId(fromAddress, fromIndex);
        const from = fromMaps?.[fromIndex];
        const toMaps = this._maps.find(toAddress)?.value;
        const toIndex = toMaps ? toMaps.length - 1 : 0;
        const toId = new MapId(toAddress, toIndex);
        const to = toMaps?.[toIndex];
        if (!(fromAddress === kNullAddress || from)) {
            warn(`LogProcessor.processMapEvent(): Map not found for source map address ${formatAddress(fromAddress)}`);
        }
        if (!(toAddress === kNullAddress || to)) {
            warn(`LogProcessor.processMapEvent(): Map not found for target map address ${formatAddress(toAddress)}`);
        }

        const name = SymbolName.tryParse(nameString) ?? nameString;
        const update = new MapEntryUpdate(
            this._sources,
            event,
            timestamp,
            fromId,
            from,
            toId,
            to,
            reason,
            name
        );

        if (line > 0 && column > 0) {
            const code = this.findProfileEntry(pc);
            if (code) {
                const { name, filePosition: codeFilePosition } = code.functionName;
                update.functionName = name;
                update.functionEntry = codeFilePosition && this._functions.get(codeFilePosition);
                update.filePosition = codeFilePosition && new Location(codeFilePosition.uri, new Position(line - 1, column - 1));
            }
        }

        if (to) {
            if (to.updates.length === 0) {
                to.baseMap = from && new MapReference(fromAddress, fromIndex, from, reason);
            }

            to.updates.push(update);
        }

        if (from && to) {
            from.referencedBy.push(new MapReferencedByMap(new MapReference(toAddress, toIndex, to, reason)));
            for (const sourceProperty of from.properties) {
                const existingProperty = to.properties.find(property => PropertyNameEqualer.equals(property.name, sourceProperty.name));
                if (existingProperty) {
                    existingProperty.map ??= sourceProperty.map;
                    existingProperty.source ??= sourceProperty.source;
                }
                else {
                    to.properties.push(sourceProperty.clone());
                }
            }
            if (event === MapEvent.Transition) {
                const existingProperty = to.properties.find(property => PropertyNameEqualer.equals(property.name, name));
                if (existingProperty) {
                    existingProperty.map = new MapReference(toAddress, toIndex, to, reason);
                    existingProperty.source ??= update.functionEntry;
                }
                else {
                    to.properties.push(new MapProperty(name, { map: new MapReference(toAddress, toIndex, to, reason), source: update.functionEntry, update }));
                }
            }
        }
    }

    // #endregion maps

    // #region profiles

    // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1049
    private processProfilerEvent(event: string, samplingInterval?: number) {
        if (event === "begin" && samplingInterval !== undefined && isFinite(samplingInterval)) {
        }
    }

    // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1105
    private processTimerEventStart(name: string, start: TimeTicks) {
    }

    // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1105
    private processTimerEventEnd(name: string, end: TimeTicks) {
    }

    // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1098
    private processCurrentTime(timestamp: TimeTicks) {
    }

    // TICK_EVENT
    // event definition: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/code-events.h#L40
    // event source: https://github.com/v8/v8/blob/01c670e416310453b01533a85057a3e2db3ac64f/src/logging/log.cc#L1741
    private processTickEvent(pc: Address, timestamp: TimeTicks, isExternalCallback: number, topOfStackOrExternalCallback: Address, vmState: VmState, stack: string[]) {
        // https://github.com/v8/v8/blob/6bbf2dfa5b3bde9a40527268741b739f7d7e4bd0/src/profiler/symbolizer.cc#L48
        const sample = new TickSample(pc, timestamp, !!isExternalCallback, topOfStackOrExternalCallback, vmState, this._reader.processStack(pc, kNullAddress, stack));
        this._profile.recordTick(sample);
    }

    // #endregion profiles

    // #region memory

    private processHeapCapacityEvent(size: number) {
        this._heapCapacity = size;
    }

    private processHeapAvailableEvent(size: number) {
        this._heapAvailable = size;
    }

    private changeMemoryCategorySize(categories: Map<string, MemoryCategory>, name: string, sizeDelta: number) {
        let memoryCategory = categories.get(name);
        if (!memoryCategory) {
            if (sizeDelta < 0) {
                return;
            }

            categories.set(name, memoryCategory = new MemoryCategory(name, 0, 0));
        }

        memoryCategory.size += sizeDelta;
        if (memoryCategory.maxSize < memoryCategory.size) {
            memoryCategory.maxSize = memoryCategory.size;
        }
    }

    // event source: https://github.com/v8/v8/blob/89f05508b15561c37bc0545d989050b34a342f9f/src/logging/log.cc#L1234
    private processNewEvent(name: string, object: Address, size: number) {
        if (size <= 0) {
            if (name !== "CodeRange") {
                log(`skipping 'new' event for category '${name}' with size 0`);
            }
            return;
        }

        const existing = this._memory.find(object)?.value;
        if (existing) {
            log(`'new' event for category '${name}' at address ${formatAddress(object)} replaced an existing entry.`);
            this._memory.remove(object);
        }
        this._memory.insert(object, new MemoryEntry(name, size));
        this._memorySize += size;
        if (this._maxMemorySize < this._memorySize) {
            this._maxMemorySize = this._memorySize;
        }

        this.changeMemoryCategorySize(this._memorySizes, name, size);
    }

    // event source: https://github.com/v8/v8/blob/89f05508b15561c37bc0545d989050b34a342f9f/src/logging/log.cc#L1242
    private processDeleteEvent(name: string, object: Address) {
        const existing = this._memory.find(object)?.value;
        if (!existing) {
            warn(`'delete' event for category '${name}' at ${formatAddress(object)} referenced an allocation that was not recorded.`);
            return;
        }

        if (existing.name !== name) {
            warn(`'delete' event category '${name}' did not match existing memory category '${existing.name}'.`);
        }

        this._memory.remove(object);
        this._memorySize -= existing.size;
        this.changeMemoryCategorySize(this._memorySizes, existing.name, -existing.size);
    }

    // #endregion
}

export type ProcessorParameter<T extends Parser> =
    T extends (s: string) => infer U ? U :
    T extends { readonly parser: (s: string) => infer U, readonly rest: true } ? U[] :
    T extends { readonly parser: (s: string) => infer U, readonly optional: true } ? U | undefined :
    T extends { readonly parser: typeof parseString, readonly rest: true } ? string[] :
    T extends { readonly parser: typeof parseString, readonly optional: true } ? string | undefined :
    T extends typeof commandNameArg ? string :
    T extends typeof cancelTokenArg ? CancellationToken | undefined :
    T extends typeof parseString ? string :
    T extends typeof parseInt32 ? number :
    T extends typeof parseVarArgs ? string[] :
    never;

type ProcessorParameters<A extends Parsers> = Extract<{ [P in keyof A]: ProcessorParameter<Extract<A[P], Parser>> }, readonly any[]>;

interface TypedDispatcher<T extends Parsers> {
    parsers: T;
    processor(...args: ProcessorParameters<T>): void;
}

function DISPATCHER<T extends Parsers>(dispatcher: TypedDispatcher<T>) {
    return dispatcher;
}

function uriToString(x: Uri) {
    return x.toString();
}
