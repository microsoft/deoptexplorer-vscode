// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { SourceMapBias } from "#core/sourceMap.js";
import { TimeDelta } from "#core/time.js";
import { UriEqualer } from "#core/uri.js";
import { CodeEntry } from "#v8/tools/codeentry.js";
import { ProfileViewNode } from "#v8/tools/profile_view.js";
import { FileLineTick, LineTick } from "#v8/tools/types.js";
import { CancellationToken, Location, Position } from "vscode";
import { CanonicalUri, getCanonicalUri } from "../services/canonicalPaths";
import { isArray } from "../utils/types";
import { LogFile } from "./logFile";

/**
 * A snapshot of the current `ProfileViewNode` to be displayed in the UI
 */
export class ProfileViewNodeSnapshot {
    readonly log: LogFile | undefined;
    readonly tokenPath: readonly symbol[];
    readonly entry: CodeEntry;
    readonly totalTime: number;
    readonly totalPercent: number;
    readonly selfTime: number;
    readonly selfPercent: number;
    readonly parentTotalPercent: number;
    readonly lineTicks: readonly LineTick[];

    private _fileLineTicks: readonly FileLineTick[] | undefined;
    private _mappedLineTicks: readonly FileLineTick[] | Promise<readonly FileLineTick[]> | undefined;

    constructor(log: LogFile | undefined, node: ProfileViewNode) {
        this.log = log;
        this.tokenPath = node.tokenPath;
        this.entry = node.entry;
        this.totalTime = node.totalTime;
        this.totalPercent = node.totalPercent;
        this.selfTime = node.selfTime;
        this.selfPercent = node.selfPercent;
        this.parentTotalPercent = node.parentTotalPercent;
        this.lineTicks = node.lineTicks.map(({ line, hitCount }) => new LineTick(line, hitCount));
    }

    get generatedFilePosition() {
        return this.entry.generatedFilePosition ?? this.entry.filePosition ?? this.entry.functionName.filePosition;
    }

    get filePosition() {
        return this.entry.filePosition ?? this.entry.functionName.filePosition;
    }

    get averageSampleDuration() {
        return this.log?.profile.averageSampleDuration ?? TimeDelta.fromMilliseconds(1);
    }

    get profileDuration() {
        return this.log?.profile.duration ?? TimeDelta.fromMilliseconds(1);
    }

    getFileLineTicks() {
        if (this._fileLineTicks) return this._fileLineTicks;
        const location = this.entry.generatedFilePosition ?? this.entry.filePosition ?? this.entry.functionName.filePosition;
        const uri = location && getCanonicalUri(location.uri);
        return this._fileLineTicks = uri ? this.lineTicks.map(({ line, hitCount: hit_count }) => new FileLineTick(uri, line, hit_count)) : [];
    }

    tryGetMappedLineTicks() {
        return isArray(this._mappedLineTicks) ? this._mappedLineTicks : undefined;
    }

    async getMappedLineTicksAsync(token?: CancellationToken) {
        return this._mappedLineTicks ??= this._getMappedLineTicksAsync(token);
    }

    private async _getMappedLineTicksAsync(token?: CancellationToken) {
        const location = this.entry.generatedFilePosition ?? this.entry.filePosition ?? this.entry.functionName.filePosition;
        const uri = location && getCanonicalUri(location.uri);
        const sourceMap = uri && this.log ? this.log.sources.getExistingSourceMap(uri) ?? await this.log.sources.getSourceMapAsync(uri) : "no-sourcemap";
        const mappedLineTicks: FileLineTick[] = [];
        if (!token?.isCancellationRequested) {
            let sourceFile: CanonicalUri | undefined;
            if (sourceMap !== "no-sourcemap") {
                for (const lineTick of this.getFileLineTicks()) {
                    const fileUri = lineTick.file;
                    const generatedLocation = new Location(fileUri, new Position(lineTick.line, 0));
                    const sourceLocation = sourceMap.toSourceLocation(generatedLocation, SourceMapBias.LEAST_UPPER_BOUND);
                    if (sourceLocation) {
                        const canonicalSourceFile = getCanonicalUri(sourceLocation.uri);
                        if (!sourceFile || UriEqualer.equals(sourceFile, canonicalSourceFile)) {
                            sourceFile = canonicalSourceFile;
                            mappedLineTicks.push(new FileLineTick(sourceFile, sourceLocation.range.start.line, lineTick.hitCount));
                            continue;
                        }
                    }
                    mappedLineTicks.push(lineTick);
                }
            }
        }
        return this._mappedLineTicks = mappedLineTicks;
    }
}
