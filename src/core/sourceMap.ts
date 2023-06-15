// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { getCanonicalUri } from "#extension/services/canonicalPaths.js";
import { pathOrUriStringToUri } from "#extension/vscode/uri.js";
import * as source_map from "source-map";
import { FindPosition, MappedPosition, SourceFindPosition, SourceMapConsumer } from "source-map";
import { Location, Position, Range, Uri } from "vscode";
import { assert } from "./assert";
import { ensureRelativePathIsDotted } from "./paths";
import { resolveUri, UriEqualer } from "./uri";

declare module "source-map" {
    interface SourceMapConsumer {
        /** Absolute sources */
        readonly sources: readonly string[];
        readonly sourcesContent?: readonly string[] | null;
    }
}

export enum SourceMapBias {
    GREATEST_LOWER_BOUND = SourceMapConsumer.GREATEST_LOWER_BOUND,
    LEAST_UPPER_BOUND = SourceMapConsumer.LEAST_UPPER_BOUND,
}

export enum MappingOrder {
    GENERATED_ORDER = SourceMapConsumer.GENERATED_ORDER,
    ORIGINAL_ORDER = SourceMapConsumer.ORIGINAL_ORDER
}

export class SourceLocation extends Location {
    name: string | undefined;
    constructor(uri: Uri, rangeOrPosition: Range | Position, name?: string) {
        super(uri, rangeOrPosition);
        this.name = name;
    }
}

export class SourceMap {
    private _sourceMap: source_map.SourceMapConsumer;
    private _sourceMapUri: Uri;
    private _sources: readonly Uri[] | undefined;

    constructor(
        readonly generatedUri: Uri,
        sourceMap: string,
        sourceMapUri: Uri
    ) {
        this._sourceMapUri = sourceMapUri;
        this._sourceMap = new (source_map.SourceMapConsumer as new (sourceMap: source_map.RawSourceMap | string, sourceMapUrl?: string) => source_map.SourceMapConsumer)(sourceMap, this._sourceMapUri.toString());
        this._sourceMap.computeColumnSpans();
    }

    get sources() {
        return this._sources ??= this._sourceMap.sources.map(source => getCanonicalUri(pathOrUriStringToUri(source)));
    }

    toSourceLocation(value: Location | Position | Range, bias?: SourceMapBias) {
        if (value instanceof Location) {
            assert(UriEqualer.equals(value.uri, this.generatedUri));
            value = value.range;
        }
        return value instanceof Range ?
            this._rangeToSourceLocation(value, bias) :
            this._positionToSourceLocation(value, bias);
    }

    toGeneratedLocation(value: Location, bias?: SourceMapBias) {
        const range = this.toGeneratedRange(value, bias);
        return range && new Location(this.generatedUri, range);
    }

    toGeneratedRange(value: Location, bias?: SourceMapBias) {
        return this._rangeToGeneratedRange(value.uri.toString(), value.range, bias);
    }

    toAllGeneratedLocations(value: Location, collapse?: "start" | "end") {
        const result: Location[] = [];
        for (const position of this.toAllGeneratedPositions(value, collapse)) {
            result.push(new Location(this.generatedUri, position));
        }
        return result;
    }

    toAllGeneratedPositions(value: Location, collapse: "start" | "end" = "start") {
        const position = value.range[collapse];
        return this._positionToGeneratedPositions(value.uri.toString(), position);
    }

    sourceContentFor(source: string) {
        const result = this._sourceMap.sourceContentFor(source, true);
        return typeof result === "string" ? result : undefined;
    }

    hasContentsOfAllSources() {
        return this._sourceMap.hasContentsOfAllSources();
    }

    forEachMapping<T>(cb: (this: T, mapping: SourceMapping) => void, thisArg: T, order?: MappingOrder): void;
    forEachMapping(cb: (mapping: SourceMapping) => void, thisArg?: any, order?: MappingOrder): void;
    forEachMapping(cb: (mapping: SourceMapping) => void, thisArg?: any, order?: MappingOrder): void {
        this._sourceMap.eachMapping(mapping => {
            const baseMapping = isValidMappingItem(mapping) ? mapping : undefined;
            if (!baseMapping) return;
            const generatedPosition = PositionConverters.toVSCodePosition({
                line: baseMapping.generatedLine,
                column: baseMapping.generatedColumn
            });
            const generatedLocation = new Location(this.generatedUri, generatedPosition);
            if (typeof baseMapping.source === "string") {
                const sourceUri = resolveUri(this._sourceMapUri, ensureRelativePathIsDotted(baseMapping.source));
                const sourcePosition = PositionConverters.toVSCodePosition({
                    line: baseMapping.originalLine,
                    column: baseMapping.originalColumn
                });
                const sourceLocation = new SourceLocation(sourceUri, sourcePosition, baseMapping.name ?? undefined);
                cb.call(thisArg, new SourceMapping(generatedLocation, sourceLocation));
            }
            else {
                cb.call(thisArg, new SourceMapping(generatedLocation));
            }
        }, null, order);
    }

    private _rangeToSourceLocation(range: Range, bias?: SourceMapBias) {
        if (range.isEmpty) {
            return this._positionToSourceLocation(range.start, bias);
        }

        const generatedStart: FindPosition = {
            ...PositionConverters.toSourceMapPosition(range.start),
            bias: bias ?? SourceMapConsumer.LEAST_UPPER_BOUND
        };
        assert(isValidSourceMapFindPosition(generatedStart));

        const generatedEnd: FindPosition = {
            ...PositionConverters.toSourceMapPosition(range.end),
            bias: bias ?? SourceMapConsumer.GREATEST_LOWER_BOUND
        };
        assert(isValidSourceMapFindPosition(generatedEnd));

        const mappedStart = this._sourceMap.originalPositionFor(generatedStart);
        if (mappedStart && isValidSourceMapMappedPosition(mappedStart)) {
            const mappedEnd = this._sourceMap.originalPositionFor(generatedEnd);
            if (mappedEnd && isValidSourceMapMappedPosition(mappedEnd) &&
                mappedStart.source === mappedEnd.source) {
                const sourceStart = PositionConverters.toVSCodePosition(mappedStart);
                const sourceEnd = PositionConverters.toVSCodePosition(mappedEnd);
                const sourceRange = sourceStart.isBeforeOrEqual(sourceEnd) ?
                    new Range(sourceStart, sourceEnd) :
                    new Range(sourceEnd, sourceStart);
                return new SourceLocation(
                    resolveUri(this._sourceMapUri, mappedStart.source),
                    sourceRange,
                    mappedStart.name ?? mappedEnd.name
                );
            }
        }
    }

    private _positionToSourceLocation(position: Position, bias?: SourceMapBias) {
        // https://github.com/mozilla/source-map#sourcemapconsumerprototypeoriginalpositionforgeneratedposition
        // > - `line`: [...] Line numbers in this library are 1-based (note that the underlying source map specification uses 0-based line numbers -- this library handles the translation)
        // > - `column`: [...] Column numbers in this library are 0-based.
        const generatedPosition: FindPosition = {
            ...PositionConverters.toSourceMapPosition(position),
            bias
        };
        assert(isValidSourceMapFindPosition(generatedPosition));

        const mappedPosition = this._sourceMap.originalPositionFor(generatedPosition);
        if (mappedPosition && isValidSourceMapMappedPosition(mappedPosition)) {
            return new SourceLocation(
                resolveUri(this._sourceMapUri, mappedPosition.source),
                PositionConverters.toVSCodePosition(mappedPosition),
                mappedPosition.name
            );
        }
    }

    private _rangeToGeneratedRange(source: string, range: Range, bias?: SourceMapBias) {
        if (range.isEmpty) {
            return this._positionToGeneratedRange(source, range.start, bias);
        }
        const sourceStart: SourceFindPosition = {
            source,
            ...PositionConverters.toSourceMapPosition(range.start),
            bias: bias ?? SourceMapConsumer.LEAST_UPPER_BOUND
        };
        assert(isValidSourceMapSourceFindPosition(sourceStart));

        const sourceEnd: SourceFindPosition = {
            source,
            ...PositionConverters.toSourceMapPosition(range.end),
            bias: bias ?? SourceMapConsumer.GREATEST_LOWER_BOUND
        };
        assert(isValidSourceMapSourceFindPosition(sourceEnd));

        const mappedStart = this._sourceMap.generatedPositionFor(sourceStart);
        if (mappedStart && isValidSourceMapPosition(mappedStart)) {
            const mappedEnd = this._sourceMap.generatedPositionFor(sourceEnd);
            if (mappedEnd && isValidSourceMapPosition(mappedEnd)) {
                const generatedStart = PositionConverters.toVSCodePosition(mappedStart);
                const generatedEnd = PositionConverters.toVSCodePosition(mappedEnd);
                const generatedRange = generatedStart.isBeforeOrEqual(generatedEnd) ?
                    new Range(generatedStart, generatedEnd) :
                    new Range(generatedEnd, generatedStart);
                return generatedRange;
            }
        }
    }

    private _positionToGeneratedRange(source: string, position: Position, bias?: SourceMapBias) {
        const sourcePosition: SourceFindPosition = {
            source,
            ...PositionConverters.toSourceMapPosition(position),
            bias
        };
        assert(isValidSourceMapSourceFindPosition(sourcePosition));
        const lineRange = this._sourceMap.generatedPositionFor(sourcePosition);
        if (lineRange) {
            if (isValidSourceMapLineRange(lineRange)) {
                return LineRangeConverters.toVSCodeRange(lineRange);
            }
            if (isValidSourceMapPosition(lineRange)) {
                const pos = PositionConverters.toVSCodePosition(lineRange);
                return new Range(pos, pos);
            }
        }
    }

    private _positionToGeneratedPositions(source: string, position: Position) {
        const sourcePosition: MappedPosition = {
            source,
            ...PositionConverters.toSourceMapPosition(position),
        };
        assert(isValidSourceMapMappedPosition(sourcePosition));
        const generatedPositions = this._sourceMap.allGeneratedPositionsFor(sourcePosition);
        const result: Position[] = [];
        for (const generatedPosition of generatedPositions) {
            if (isValidSourceMapPosition(generatedPosition)) {
                result.push(PositionConverters.toVSCodePosition(generatedPosition));
            }
        }
        return result;
    }
}

export class SourceMapping {
    constructor(
        public generatedLocation: Location,
        public sourceLocation?: SourceLocation,
    ) {}
}

export function extractSourceMappingURL(content: string, file: Uri) {
    // NOTE: copied from source-map-support, see the third party license notice above.
    const re = /(?:\/\/[@#][\s]*sourceMappingURL=([^\s'"]+)[\s]*$)|(?:\/\*[@#][\s]*sourceMappingURL=([^\s*'"]+)[\s]*(?:\*\/)[\s]*$)/mg;
    let lastMatch, match;
    while (match = re.exec(content)) lastMatch = match;
    const sourceMappingURL = lastMatch?.[1] || lastMatch?.[2];
    return sourceMappingURL ? resolveUri(file, sourceMappingURL) : undefined;
}

const sourceMapDataUrlRegExp = /^application\/json(?:;charset=[uU][tT][fF]-8)?;base64,(?<data>.*)/;

export function getInlineSourceMapData(sourceMappingURL: Uri): string | undefined {
    if (sourceMappingURL.scheme !== "data" || sourceMappingURL.authority) return undefined;
    const match = sourceMapDataUrlRegExp.exec(sourceMappingURL.path);
    if (!match?.groups) return undefined;
    return Buffer.from(match.groups.data, "base64").toString();
}

interface ValidMappingItemWithoutSource {
    generatedLine: number;
    generatedColumn: number;
    source?: null;
    originalLine?: null;
    originalColumn?: null;
    name?: null;
}

interface ValidMappingItemWithSource {
    generatedLine: number;
    generatedColumn: number;
    source: string;
    originalLine: number;
    originalColumn: number;
    name?: string | null;
}

function isValidSourceMapPosition(pos: source_map.Position) {
    return !!pos
        && typeof pos.line === "number" && pos.line >= 1
        && typeof pos.column === "number" && pos.column >= 0;
}

function isValidSourceMapLineRange(pos: source_map.LineRange) {
    return isValidSourceMapPosition(pos)
        && typeof pos.lastColumn === "number" && pos.lastColumn >= pos.column;
}

function isValidSourceMapBias(bias: number | undefined) {
    return bias === null ||
        bias === undefined ||
        typeof bias === "number" && (
            bias === SourceMapConsumer.LEAST_UPPER_BOUND ||
            bias === SourceMapConsumer.GREATEST_LOWER_BOUND);
}

function isValidSourceMapFindPosition(pos: source_map.FindPosition) {
    return isValidSourceMapPosition(pos)
        && isValidSourceMapBias(pos.bias);
}

function isValidSourceMapSourceFindPosition(pos: source_map.SourceFindPosition) {
    return isValidSourceMapFindPosition(pos)
        && typeof pos.source === "string";
}

function isValidSourceMapMappedPosition(pos: source_map.MappedPosition) {
    return isValidSourceMapPosition(pos)
        && typeof pos.source === "string"
        && (pos.name === undefined || pos.name === null || typeof pos.name === "string");
}

function isValidMappingItemWithoutSource(item: Partial<ValidMappingItemWithoutSource | ValidMappingItemWithSource>): item is ValidMappingItemWithoutSource {
    return item !== null
        && item !== undefined
        && typeof item.generatedLine === "number" && item.generatedLine >= 0
        && typeof item.generatedColumn === "number" && item.generatedColumn >= 0
        && (item.source === null || item.source === undefined)
        && (item.originalLine === null || item.originalLine === undefined)
        && (item.originalColumn === null || item.originalColumn === undefined)
        && (item.name === null || item.name === undefined);
}

function isValidMappingItemWithSource(item: Partial<ValidMappingItemWithoutSource | ValidMappingItemWithSource>): item is ValidMappingItemWithSource {
    return item !== null
        && item !== undefined
        && typeof item.generatedLine === "number" && item.generatedLine >= 0
        && typeof item.generatedColumn === "number" && item.generatedColumn >= 0
        && typeof item.source === "string"
        && typeof item.originalLine === "number" && item.originalLine >= 0
        && typeof item.originalColumn === "number" && item.originalColumn >= 0
        && (item.name === null || item.name === undefined || typeof item.name === "string");
}

function isValidMappingItem(item: Partial<ValidMappingItemWithoutSource | ValidMappingItemWithSource>): item is ValidMappingItemWithoutSource | ValidMappingItemWithSource {
    return isValidMappingItemWithoutSource(item)
        || isValidMappingItemWithSource(item);
}

namespace PositionConverters {
    // https://github.com/mozilla/source-map#sourcemapconsumerprototypeoriginalpositionforgeneratedposition
    // > - `line`: [...] Line numbers in this library are 1-based (note that the underlying source map specification uses 0-based line numbers -- this library handles the translation)
    // > - `column`: [...] Column numbers in this library are 0-based.
    export function toSourceMapPosition(position: Position): source_map.Position {
        const result: source_map.Position = {
            line: position.line + 1,
            column: position.character
        };
        assert(isValidSourceMapPosition(result));
        return result;
    }

    export function toVSCodePosition(position: source_map.Position): Position {
        assert(isValidSourceMapPosition(position));
        return new Position(
            position.line - 1,
            position.column
        );
    }
}

namespace LineRangeConverters {
    export function toSourceMapLineRange(range: Range): source_map.LineRange {
        assert(range.start.line === range.end.line);
        const result: source_map.LineRange = {
            ...PositionConverters.toSourceMapPosition(range.start),
            lastColumn: range.end.character
        };
        assert(isValidSourceMapLineRange(result));
        return result;
    }

    export function toVSCodeRange(range: source_map.LineRange): Range {
        assert(isValidSourceMapLineRange(range));
        const start = PositionConverters.toVSCodePosition(range);
        const end = start.with({ character: range.lastColumn });
        return new Range(start, end);
    }
}