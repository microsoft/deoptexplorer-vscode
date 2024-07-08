// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { identity } from "@esfx/fn";
import { from } from "@esfx/iter-query";
import { StringMap } from "#core/collections/stringMap.js";
import { Sources } from "#core/sources.js";
import { DeoptEntry } from "#deoptigate/deoptEntry.js";
import { FunctionEntry } from "#deoptigate/functionEntry.js";
import { IcEntry } from "#deoptigate/icEntry.js";
import { Profile } from "#v8/tools/profile.js";
import { Location, Position, Uri } from "vscode";
import { createFinder } from "../components/finder";
import { getCanonicalUri } from "../services/canonicalPaths";
import { Entry } from "./entry";
import { FileEntry } from "./fileEntry";
import { FunctionName } from "./functionName";
import { MapEntry, MapId } from "./mapEntry";
import { computeCommonBaseDirectory, relativeUriFragment, uriBasename } from "#core/uri.js";
import { V8Version } from "#core/v8Version.js";
import { MemoryOverview } from "./memoryOverview";
import { ReadonlyStringSet } from "#core/collections/stringSet.js";

export class LogFile {
    private _fileEntryFinders = new StringMap<Uri, Record<Entry["kind"], (position: Position) => Iterable<Entry>>>(uriToString);
    private _commonBaseDirectory: Uri | undefined | null;

    constructor(
        readonly version: V8Version,
        readonly entries: ReadonlyMap<Location, { function?: FunctionEntry, ic?: IcEntry, deopt?: DeoptEntry }>,
        readonly files: ReadonlyMap<Uri, FileEntry>,
        readonly maps: ReadonlyMap<MapId, MapEntry>,
        readonly profile: Profile,
        readonly memory: MemoryOverview,
        // readonly timerInfo: TimerInfo,
        readonly sourcePaths: ReadonlyStringSet<Uri>,
        readonly generatedPaths: ReadonlyStringSet<Uri>,
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