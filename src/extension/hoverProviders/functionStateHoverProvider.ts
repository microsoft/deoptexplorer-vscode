// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable } from "@esfx/disposable";
import { from } from "@esfx/iter-query";
import { RangeMap } from "#core/collections/rangeMap.js";
import { markdown, MarkdownString } from "#core/markdown.js";
import { MruCache } from "#core/mruCache.js";
import { TimeTicksComparer } from "#core/time.js";
import { FunctionEntry } from "#deoptigate/functionEntry.js";
import { formatFunctionState, FunctionState, isCompiledFunctionState, isInterpretedFunctionState, isOptimizedFunctionState } from "#v8/enums/functionState.js";
import { CancellationToken, Hover, HoverProvider, Position, ProviderResult, Range, TextDocument, Uri } from "vscode";
import * as constants from "../constants";
import { unwrapScriptSource } from "../fileSystemProviders/scriptSourceFileSystemProvider";
import { formatMillisecondsHighPrecision } from "../formatting/numbers";
import { Entry } from "../model/entry";
import { getCanonicalUri } from "../services/canonicalPaths";
import { openedLog } from "../services/currentLogFile";
import { CommandUri } from "../vscode/commandUri";
import { entryContainsPosition } from "./utils";

const LINE_RANGE = 5;

export class FunctionStateHoverProvider implements HoverProvider {
    private _perFileHoverCache = new MruCache<RangeMap<Hover>>();

    resetCache() {
        this._perFileHoverCache.clear();
    }

    provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
        if (!openedLog) return;

        let hoverCache = this._perFileHoverCache.get(document.uri);
        if (hoverCache) {
            const entry = from(hoverCache.findAll(position)).first();
            if (entry) return entry[1];
        }

        const uri = unwrapScriptSource(document.uri).uri;
        if (!uri) return;

        const file = getCanonicalUri(uri);
        const line = position.line + 1;
        const startLine = line - LINE_RANGE;
        const endLine = line + LINE_RANGE;
        const containsPosition = (entry: Entry) => entryContainsPosition(entry, file, startLine, endLine, position);
        const functions = openedLog.files.get(file)?.functions.filter(containsPosition);
        if (functions?.length) {
            let range: Range | undefined;
            const messages: MarkdownString[] = [];
            for (const entry of functions) {
                const functionRange = entry.pickReferenceLocation(file).range;
                range = range?.intersection(functionRange) ?? functionRange;
                messages.push(...getHoverMessageForFunctionEntry(entry, file));
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

function formatSummaryForFunctionState(state: FunctionState | undefined, optimizeCount: number) {
    if (state === undefined) return "Unknown";
    if (isCompiledFunctionState(state)) return "Compiled";
    if (isInterpretedFunctionState(state)) return "Optimizable";
    if (isOptimizedFunctionState(state)) return optimizeCount > 1 ? "Reoptimized" : "Optimized";
}

function * getHoverMessageForFunctionEntry(entry: FunctionEntry, file: Uri) {
    let state: FunctionState | undefined = undefined;
    let optimizeCount = 0;
    for (const update of entry.updates) {
        state = update.state;
        if (isOptimizedFunctionState(state)) {
            optimizeCount++;
        }
    }

    yield markdown.code("text")`${formatSummaryForFunctionState(state, optimizeCount)}`;
    yield markdown.table(
        [
            { text: "Timestamp", align: "right" },
            { text: "State", align: "left" }
        ],
        from(entry.updates)
        .orderBy(update => update.timestamp, TimeTicksComparer)
        .select(update => [
            /* Timestamp */ formatMillisecondsHighPrecision(update.timestamp.sinceOrigin().inMillisecondsF()),
            /* State */ formatFunctionState(update.state)
        ])
    )
    yield markdown.trusted`[Detailed history](${new CommandUri(constants.commands.functions.showFunctionHistory, [entry.filePosition])})`;
}
