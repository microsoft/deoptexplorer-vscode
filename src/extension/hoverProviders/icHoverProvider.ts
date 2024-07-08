// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable } from "@esfx/disposable";
import { isDefined } from "@esfx/fn";
import { from } from "@esfx/iter-query";
import { RangeMap } from "#core/collections/rangeMap.js";
import { markdown, MarkdownString } from "#core/markdown.js";
import { MruCache } from "#core/mruCache.js";
import { IcEntry, IcEntryUpdate } from "#deoptigate/icEntry.js";
import { formatIcState, IcState } from "#v8/enums/icState.js";
import { CancellationToken, Hover, HoverProvider, Position, ProviderResult, Range, TextDocument, Uri } from "vscode";
import { commands } from "../constants";
import { getScriptSourceUri, unwrapScriptSource } from "../fileSystemProviders/scriptSourceFileSystemProvider";
import { Entry } from "../model/entry";
import { MapEntry } from "../model/mapEntry";
import { getCanonicalUri } from "../services/canonicalPaths";
import { openedLog } from "../services/currentLogFile";
import { CommandUri } from "../vscode/commandUri";
import { entryContainsPosition } from "./utils";

const LINE_RANGE = 5;

export class ICHoverProvider implements HoverProvider {
    private _perFileHoverCache = new MruCache<RangeMap<Hover>>();

    resetCache() {
        this._perFileHoverCache.clear();
    }

    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        if (!openedLog) return;

        let hoverCache = this._perFileHoverCache.get(document.uri);
        if (hoverCache) {
            const entry = from(hoverCache.findAllContaining(position)).first();
            if (entry) return entry[1];
        }

        const uri = unwrapScriptSource(document.uri).uri;
        if (!uri) return;

        const file = getCanonicalUri(uri);
        const line = position.line + 1;
        const startLine = line - LINE_RANGE;
        const endLine = line + LINE_RANGE;
        const containsPosition = (entry: Entry) => entryContainsPosition(entry, file, startLine, endLine, position);
        const ics = openedLog.files.get(file)?.ics.filter(containsPosition);
        if (ics?.length) {
            let range: Range | undefined;
            const messages: MarkdownString[] = [];
            for (const entry of ics) {
                const worst = from(entry.updates).maxBy(update => update.newState);
                if (worst) {
                    const icRange = entry.pickReferenceLocation(file).range;
                    range = range?.intersection(icRange) ?? icRange;
                    messages.push(...getHoverMessageForIc(entry, worst, file));
                }
            }
            if (messages) {
                if (!hoverCache) {
                    hoverCache = new RangeMap();
                    this._perFileHoverCache.set(document.uri, hoverCache);
                }
                range ??= new Range(position, position);
                const hover = new Hover(messages, range);
                hoverCache.set(range, hover);
                return hover;
            }
        }
    }

    [Disposable.dispose]() {
        this.resetCache();
    }
}

function getDescriptionForIcState(state: IcState) {
    switch (state) {
        case IcState.NO_FEEDBACK: return "No Feedback";
        case IcState.UNINITIALIZED: return "Uninitialized";
        case IcState.PREMONOMORPHIC: return "Premonomorphic";
        case IcState.MONOMORPHIC: return "Monomorphic";
        case IcState.POLYMORPHIC: return "Polymorphic";
        case IcState.RECOMPUTE_HANDLER: return "Recompute Handler";
        case IcState.MEGAMORPHIC: return "Megamorphic";
        case IcState.GENERIC: return "Generic";
    }
}

function formatSummaryForIcEntryUpdate(update: IcEntryUpdate) {
    const stateName = getDescriptionForIcState(update.newState);
    switch (update.type) {
        case "StoreIC": return `${stateName} assignment to property '${update.key}'.`;
        case "LoadIC": return `${stateName} read from property '${update.key}'.`;
        case "KeyedStoreIC": return `${stateName} assignment to element [${update.key}].`;
        case "KeyedLoadIC": return `${stateName} read from element [${update.key}].`;
        case "StoreGlobalIC": return `${stateName} assignment to global '${update.key}'.`;
        case "LoadGlobalIC": return `${stateName} read from global '${update.key}'.`;
        case "StoreInArrayLiteralIC": return `${stateName} assignment to array literal element [${update.key}].`;
        default: return `${stateName} ${update.type} for '${update.key}'.`;
    }
}

function getLastPropertySource(map: MapEntry) {
    const source = map.getMapSource();
    if (source) {
        const pos = source.filePosition.range.start;
        const uri = getScriptSourceUri(source.filePosition.uri, openedLog?.sources);
        return uri ?
            markdown.trusted` | [${source.functionName}](${uri.with({ fragment: `${pos.line + 1},${pos.character + 1}` })})` :
            markdown.trusted` ${source.functionName}`;
    }
    return "";
}

function * getHoverMessageForIc(entry: IcEntry, update: IcEntryUpdate, file: Uri) {
    const mapIds = entry.updates.map(update => update.mapId.toString()).filter(isDefined);
    const referenceLocation = entry.pickReferenceLocation(file);

    yield markdown.code("text")`${formatSummaryForIcEntryUpdate(update)}`;

    yield markdown.trusted`
| Old State | New State | Key | Map | Map Source |
|:-|:-|:-|:-|:-|
${from(entry.updates)
    .select(update => markdown.trusted`| ${formatIcState(update.oldState)} | ${formatIcState(update.newState)} | ${update.key} | ${update.map
        ? markdown.trusted`[\`${new MarkdownString(update.mapId.toString()).trust()}\`](${new CommandUri(commands.maps.showMap, [
            [update.mapId.toString()],
            referenceLocation.uri,
            referenceLocation.range.start.line,
            referenceLocation.range.start.character
        ])})${getLastPropertySource(update.map)}`
        : markdown.trusted`\`${new MarkdownString(update.mapId.toString()).trust()}\``} |\n`)}`;

    yield markdown.trusted`[Peek maps](${new CommandUri(commands.maps.showMap, [
        mapIds,
        referenceLocation.uri,
        referenceLocation.range.start.line,
        referenceLocation.range.start.character
    ])})`;
}
