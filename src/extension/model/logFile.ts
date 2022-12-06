// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { identity } from "@esfx/fn";
import { from } from "@esfx/iter-query";
import { Location, Position, Uri } from "vscode";
import { StringMap } from "../../core/collections/stringMap";
import { isSupportedUri } from "../languages";
import { getCanonicalUri } from "../services/canonicalPaths";
import { createFinder } from "../components/finder";
import { Sources } from "../../core/sources";
import { Profile } from "../../third-party-derived/v8/tools/profile";
import { DeoptEntry } from "../../third-party-derived/deoptigate/deoptEntry";
import { Entry } from "./entry";
import { FileEntry } from "./fileEntry";
import { FunctionEntry } from "../../third-party-derived/deoptigate/functionEntry";
import { FunctionName } from "./functionName";
import { IcEntry } from "../../third-party-derived/deoptigate/icEntry";
import { MapEntry, MapId } from "./mapEntry";
// import { TimerInfo } from "../../third-party-derived/v8/tools/timerInfo";
import { V8Version } from "../../core/v8Version";
import { computeCommonBaseDirectory, relativeUriFragment, uriBasename } from "../../core/uri";

export class LogFile {
    private _fileEntryFinders = new StringMap<Uri, Record<Entry["kind"], (position: Position) => Iterable<Entry>>>(uriToString);
    private _commonBaseDirectory: Uri | undefined | null;

    constructor(
        readonly version: V8Version,
        readonly entries: ReadonlyMap<Location, { function?: FunctionEntry, ic?: IcEntry, deopt?: DeoptEntry }>,
        readonly files: ReadonlyMap<Uri, FileEntry>,
        readonly maps: ReadonlyMap<MapId, MapEntry>,
        readonly profile: Profile,
        // readonly timerInfo: TimerInfo,
        readonly sourcePaths: ReadonlySet<Uri>,
        readonly generatedPaths: ReadonlySet<Uri>,
        readonly sources: Sources,
    ) {
    }

    get commonBaseDirectory() {
        if (this._commonBaseDirectory === undefined) {
            this._commonBaseDirectory = computeCommonBaseDirectory(this.sourcePaths) ?? null;
        }
        return this._commonBaseDirectory ?? undefined;
    }

    tryGetRelativeUriFragment(file: Uri, { ignoreIfBasename = false } = {}) {
        const base = this.commonBaseDirectory;
        let relative = this.sourcePaths.has(file) && base ?
            relativeUriFragment(base, file) :
            undefined;
        if (relative && /^\.[\\/]/.test(relative)) {
            relative = relative.slice(2);
        }
        if (ignoreIfBasename && uriBasename(file) === relative) {
            return undefined;
        }
        return relative;
    }

    private findEntryByFilePosition<K extends Entry["kind"]>(filePosition: Location, key: K): Extract<Entry, { kind: K }> | undefined {
       return this.entries.get(filePosition)?.[key] as Extract<Entry, { kind: K }> | undefined;
    }

    private findEntryByFunctionName<K extends Entry["kind"]>(functionName: FunctionName, key: K): Extract<Entry, { kind: K }> | undefined {
        return functionName.filePosition && this.findEntryByFilePosition(functionName.filePosition, key);
    }

    findFunctionEntryByFilePosition(filePosition: Location) {
        return this.findEntryByFilePosition(filePosition, "function");
    }

    findFunctionEntryByFunctionName(functionName: FunctionName) {
        return this.findEntryByFunctionName(functionName, "function");
    }

    findDeoptEntryByFilePosition(filePosition: Location) {
        return this.findEntryByFilePosition(filePosition, "deopt");
    }

    findIcEntryByFilePosition(filePosition: Location) {
        return this.findEntryByFilePosition(filePosition, "ic");
    }

    findEntriesContainingPosition(uri: Uri, position: Position) {
        if (!isSupportedUri(uri)) return [];

        const file = getCanonicalUri(uri);
        let finders = this._fileEntryFinders.get(file);
        if (!finders) {
            const fileEntry = this.files.get(file);
            if (!fileEntry) return [];

            this._fileEntryFinders.set(file, finders = {
                function: createFinder(file, fileEntry.functions),
                ic: createFinder(file, fileEntry.ics),
                deopt: createFinder(file, fileEntry.deopts)
            });
        }

        const functions = finders.function(position);
        const ics = finders.ic(position);
        const deopts = finders.deopt(position);
        return from([functions, ics, deopts]).flatMap(identity).toArray();
    }
}

function uriToString(x: Uri) {
    return x.toString();
}