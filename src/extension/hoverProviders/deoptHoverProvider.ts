// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable } from "@esfx/disposable";
import { from } from "@esfx/iter-query";
import { CancellationToken, Hover, HoverProvider, Position, ProviderResult, Range, TextDocument } from "vscode";
import { markdown, MarkdownString } from "../../core/markdown";
import { MruCache } from "../../core/mruCache";
import { TimeTicksComparer } from "../../core/time";
import { DeoptEntry, DeoptEntryUpdate } from "../../third-party-derived/deoptigate/deoptEntry";
import { DeoptimizeKind, formatDeoptimizeKind } from "../../third-party-derived/v8/enums/deoptimizeKind";
import { formatMillisecondsHighPrecision } from "../formatting/numbers";
import { Entry } from "../model/entry";
import { getCanonicalUri } from "../services/canonicalPaths";
import { openedLog } from "../services/currentLogFile";
import { entryContainsPosition } from "./utils";
import { RangeMap } from "../../core/collections/rangeMap";
import { unwrapScriptSource } from "../fileSystemProviders/scriptSourceFileSystemProvider";

const LINE_RANGE = 5;

export class DeoptHoverProvider implements HoverProvider {
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
        const deopts = openedLog.files.get(file)?.deopts.filter(containsPosition);
        if (deopts?.length) {
            let range: Range | undefined;
            const messages: MarkdownString[] = [];
            for (const entry of deopts) {
                const worst = from(entry.updates).minBy(update => update.bailoutType);
                if (worst) {
                    const deoptRange = entry.pickReferenceLocation(file).range;
                    range = range?.intersection(deoptRange) ?? deoptRange;
                    messages.push(...getHoverMessageForDeoptEntry(entry));
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

function getDeoptReason(update: DeoptEntryUpdate) {
    return update.deoptReason ? ` - ${update.deoptReason}` : "";
}

function formatSummaryForDeoptEntryUpdate(update: DeoptEntryUpdate | undefined) {
    if (!update) return "Unknown bailout";
    switch (update.bailoutType) {
        case DeoptimizeKind.Eager: return `Eager bailout${getDeoptReason(update)}`;
        case DeoptimizeKind.Lazy: return `Lazy bailout${getDeoptReason(update)}`;
        case DeoptimizeKind.Soft: return `Soft bailout${getDeoptReason(update)}`;
        case DeoptimizeKind.DependencyChange: return `Dependency change${getDeoptReason(update)}`;
        default: return `'${formatDeoptimizeKind(update.bailoutType)}' bailout${getDeoptReason(update)}`;
    }
}

function * getHoverMessageForDeoptEntry(entry: DeoptEntry) {
    yield markdown.code("text")`${formatSummaryForDeoptEntryUpdate(from(entry.updates).minBy(update => update.bailoutType))}`;
    yield markdown.table(
        [
            { text: "Timestamp", align: "right" },
            { text: "Bailout" },
            { text: "Reason" },
            { text: "Inlined" }
        ],
        from(entry.updates)
        .orderBy(update => update.timestamp, TimeTicksComparer)
        .select(update => [
            /* Timestamp */ formatMillisecondsHighPrecision(update.timestamp.sinceOrigin().inMillisecondsF()),
            /* Bailout */ formatDeoptimizeKind(update.bailoutType),
            /* Reason */ update.deoptReason ?? "",
            /* Inlined */ `${update.inliningId > 0}`
        ])
    );
}
