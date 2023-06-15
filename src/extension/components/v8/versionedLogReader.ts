// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { V8Version } from "#core/v8Version.js";
import { Dispatcher, DispatchTable, LogReader, parseInt32, parseVarArgs } from "#v8/tools/logreader.js";
import * as semver from "semver";
import { Event, EventEmitter } from "vscode";

/**
 * A table of {@link semver.Range} strings to {@link DispatchTable} objects.
 */
export type VersionedDispatchTable = Record<string, DispatchTable>;

/**
 * A {@link LogReader} that can switch its parsing behavior based on the version of V8 that generated the log.
 */
export class VersionedLogReader extends LogReader {
    private readonly _versionedDispatchTable: VersionedDispatchTable;
    private readonly _defaultDispatchTable: DispatchTable;
    private readonly _versionRanges: readonly (readonly [string, semver.Range])[];
    private readonly _v8VersionCommand: Dispatcher;
    private readonly _onDidVersionChange: EventEmitter<V8Version>;
    private readonly _onError: EventEmitter<string>;
    private _version: V8Version | undefined;
    private _matchingVersionRangeDispatchTables: readonly DispatchTable[] | undefined;
    private _versionDispatcherCache: Map<string, Dispatcher | null | "missing">;
    private _versionCommandCache: readonly string[] | undefined;

    public readonly onDidVersionChange: Event<V8Version>;
    public readonly onError: Event<string>;

    constructor(versionedDispatchTable: VersionedDispatchTable, timedRange: boolean, pairwiseTimedRange: boolean) {
        // Proxy dispatch table that intercepts requests for commands given the last
        // matched v8 version
        const dispatchTableProxy = new Proxy<DispatchTable>(Object.create(null), {
            preventExtensions: (_target) => false,
            setPrototypeOf: (_target, _v) => false,
            defineProperty: () => false,
            deleteProperty: () => false,
            getPrototypeOf: () => null,
            isExtensible: () => true,
            set: () => false,
            has: (_target, p) => typeof p === "string" && this._getDispatcher(p) !== undefined,
            get: (_target, p, _receiver) => typeof p === "string" ? this._getDispatcher(p) : undefined,
            getOwnPropertyDescriptor: (_target, p) => {
                if (typeof p === "string") {
                    const dispatcher = this._getDispatcher(p);
                    return dispatcher === undefined ? undefined : { enumerable: false, configurable: false, writable: false, value: dispatcher };
                }
            },
            ownKeys: (_target) => this._getCommands().slice()
        });

        super(dispatchTableProxy, timedRange, pairwiseTimedRange);

        this._onDidVersionChange = new EventEmitter<V8Version>();
        this._onError = new EventEmitter<string>();

        this.onDidVersionChange = this._onDidVersionChange.event;
        this.onError = this._onError.event;

        // Validate version ranges
        const versionRanges: [string, semver.Range][] = [];
        const normalizedVersionedDispatchTable: VersionedDispatchTable = Object.create(null);
        for (const key of Object.getOwnPropertyNames(versionedDispatchTable)) {
            const range = new semver.Range(key, { loose: true });
            const normalizedKey = range.range || "*";
            normalizedVersionedDispatchTable[normalizedKey] = {
                ...normalizedVersionedDispatchTable[normalizedKey],
                ...versionedDispatchTable[key]
            };
            if (normalizedKey === "*") continue;
            versionRanges.push([normalizedKey, range]);
        }
        this._versionedDispatchTable = normalizedVersionedDispatchTable;
        this._defaultDispatchTable = this._versionedDispatchTable["*"] ?? Object.create(null);
        this._versionRanges = versionRanges;
        this._matchingVersionRangeDispatchTables = [];
        this._versionDispatcherCache = new Map();
        this._v8VersionCommand = {
            parsers: [parseInt32, parseInt32, parseInt32, parseVarArgs],
            processor: this._processV8Version.bind(this)
        };
    }

    get version() {
        return this._version;
    }

    private _getMatchingVersionRangeDispatchTables() {
        if (!this._matchingVersionRangeDispatchTables) {
            const matchingVersionDispatchTables: DispatchTable[] = [];
            if (this._version) {
                for (const [key, versionRange] of this._versionRanges) {
                    if (versionRange.test(this._version.semver)) {
                        matchingVersionDispatchTables.push(this._versionedDispatchTable[key]);
                    }
                }
            }
            this._matchingVersionRangeDispatchTables = matchingVersionDispatchTables;
        }
        return this._matchingVersionRangeDispatchTables;
    }

    private _getCommands() {
        if (!this._versionCommandCache) {
            let commands = ["v8-version"];
            for (const dispatchTable of this._getMatchingVersionRangeDispatchTables()) {
                commands = [...commands, ...Object.getOwnPropertyNames(dispatchTable)];
            }
            commands = [...commands, ...Object.getOwnPropertyNames(this._defaultDispatchTable)];
            this._versionCommandCache = [...new Set(commands)];
        }
        return this._versionCommandCache;
    }

    private _getDispatcher(command: string): Dispatcher | null | undefined {
        if (command === "v8-version") {
            return this._v8VersionCommand;
        }

        let dispatcher = this._versionDispatcherCache.get(command);
        if (dispatcher === undefined) {
            for (const dispatchTable of this._getMatchingVersionRangeDispatchTables()) {
                dispatcher = Reflect.get(dispatchTable, command);
                if (dispatcher !== undefined) break;
            }
            if (dispatcher === undefined) {
                dispatcher = Reflect.get(this._defaultDispatchTable, command);
            }
            if (dispatcher === undefined) {
                dispatcher = "missing";
            }
            this._versionDispatcherCache.set(command, dispatcher);
        }
        return dispatcher === "missing" ? undefined : dispatcher;
    }

    private _processV8Version(major: number, minor: number, rev: number, extra: string[]) {
        const version = semver.parse(`${major}.${minor}.${rev}`, { loose: true });
        if (version) {
            this._version = new V8Version(version, extra);
            this._versionDispatcherCache.clear();
            this._versionCommandCache = undefined;
            this._matchingVersionRangeDispatchTables = undefined;
            this._onDidVersionChange.fire(this._version);
        }
    }

    printError(str: string) {
        this._onError.fire(str);
    }
}
