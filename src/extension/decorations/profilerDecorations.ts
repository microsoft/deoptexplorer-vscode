// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CancelError } from "@esfx/cancelable";
import { Disposable } from "@esfx/disposable";
import { from } from "@esfx/iter-query";
import { assert } from "#core/assert.js";
import { RangeMap } from "#core/collections/rangeMap.js";
import { markdown } from "#core/markdown.js";
import { UriEqualer } from "#core/uri.js";
import { FileLineTick } from "#v8/tools/types.js";
import { CancellationError, CancellationToken, CancellationTokenSource, DecorationOptions, ExtensionContext, OverviewRulerLane, Position, Range, TextEditor, TextEditorDecorationType, window } from "vscode";
import { ShowDecorations } from "../constants";
import { unwrapScriptSource } from "../fileSystemProviders/scriptSourceFileSystemProvider";
import { formatMilliseconds } from "../formatting/numbers";
import { ProfileViewNodeSnapshot } from "../model/profileViewNodeSnapshot";
import { error } from "../outputChannel";
import { getCanonicalUri } from "../services/canonicalPaths";
import { showDecorations } from "../services/context";
import { openedLog } from "../services/currentLogFile";
import { events } from "../services/events";
import { currentProfileViewNodeSnapshot } from "../services/stateManager";
import { quartiles } from "../utils/math";
import { VSDisposableStack } from "../vscode/disposable";
import { createDecorationType, getTextEditors } from "./utils";

export class ProfilerDecorations {
    private _showProfilerDecorations: "active" | "visible" | "none" = showDecorations.has(ShowDecorations.Profiler) ? "visible" : "none";
    private _showLineTickDecorations: "active" | "visible" | "none" = showDecorations.has(ShowDecorations.LineTicks) ? "visible" : "none";
    private _maxDecorations = 2_000;
    private _disposables: VSDisposableStack;
    private _profileHeavyDecorationType: TextEditorDecorationType;
    private _profileModerateDecorationType: TextEditorDecorationType;
    private _profileLightDecorationType: TextEditorDecorationType;
    private _profileMeagerDecorationType: TextEditorDecorationType;
    private _cancelSource = new CancellationTokenSource();

    constructor() {
        const stack = new VSDisposableStack();
        try {
            this._profileHeavyDecorationType = stack.use(createDecorationType("profileHeavy", { isWholeLine: true, overviewRulerLane: OverviewRulerLane.Right }));
            this._profileModerateDecorationType = stack.use(createDecorationType("profileModerate", { isWholeLine: true, overviewRulerLane: OverviewRulerLane.Right }));
            this._profileLightDecorationType = stack.use(createDecorationType("profileLight", { isWholeLine: true, overviewRulerLane: OverviewRulerLane.Right }));
            this._profileMeagerDecorationType = stack.use(createDecorationType("profileMeager", { isWholeLine: true, overviewRulerLane: OverviewRulerLane.Right }));
            stack.use(events.onDidOpenLogFile(() => this.update()));
            stack.use(events.onDidCloseLogFile(() => this._hide()));
            stack.use(events.onDidShowDecorationsChange(() => { this._onDidShowDecorationsChange(); }));
            stack.use(events.onDidChangeCurrentProfileViewNodeSnapshot(() => this.update()));
            stack.use(window.onDidChangeActiveTextEditor(() => this.update()));
            stack.use(window.onDidChangeVisibleTextEditors(() => this.update()));
            stack.use(() => { this._hide(); });
            this._showAsync();
            this._disposables = stack.move();
        }
        finally {
            stack.dispose();
        }
    }

    get showProfilerDecorations() { return this._showProfilerDecorations; }
    set showProfilerDecorations(value) {
        if (this._showProfilerDecorations !== value) {
            this._hide();
            this._showProfilerDecorations = value;
            if (this._showProfilerDecorations !== "none") {
                this._showAsync();
            }
        }
    }

    get showLineTickDecorations() { return this._showLineTickDecorations; }
    set showLineTickDecorations(value) {
        if (this._showLineTickDecorations !== value) {
            this._hide();
            this._showLineTickDecorations = value;
            if (this._showLineTickDecorations !== "none") {
                this._showAsync();
            }
        }
    }

    private _onDidShowDecorationsChange() {
        const showProfilerDecorations = showDecorations.has(ShowDecorations.Profiler) ? "visible" : "none";
        const showLineTickDecorations = showDecorations.has(ShowDecorations.LineTicks) ? "visible" : "none";
        if (showProfilerDecorations !== this._showProfilerDecorations ||
            showLineTickDecorations !== this._showLineTickDecorations) {
            this._hide();
            this._showProfilerDecorations = showProfilerDecorations;
            this._showLineTickDecorations = showLineTickDecorations;
            if (showProfilerDecorations !== "none" || showLineTickDecorations !== "none") {
                this._showAsync();
            }
        }
    }

    private _hide() {
        this._cancelSource.cancel();
        this._cancelSource = new CancellationTokenSource();
        const editorSet = new Set<TextEditor>([
            ...getTextEditors(this._showProfilerDecorations),
            ...getTextEditors(this._showLineTickDecorations)
        ]);
        for (const editor of editorSet) {
            editor.setDecorations(this._profileMeagerDecorationType, []);
            editor.setDecorations(this._profileHeavyDecorationType, []);
            editor.setDecorations(this._profileModerateDecorationType, []);
            editor.setDecorations(this._profileLightDecorationType, []);
        }
    }

    private async _fillProfilerDecorations(editor: TextEditor, decorationsMap: Map<TextEditorDecorationType, RangeMap<Range | DecorationOptions>>, token: CancellationToken) {
        assert(openedLog);
        // const decorationGroup = feature.groups.profiler;
        // if (!decorationGroup) return;

        // let spinCounter = 0;
        // const maxCount = decorationGroup.count + DECORATION_CHUNK_SIZE;
        // const snapshot = decorationGroup.value.snapshot;

        // let functionTicks = decorationGroup.value.functionTicks;
        // if (!functionTicks) {
        //     const first = snapshot[0];
        //     if (file === (first.entry.generatedFilePosition ?? first.entry.filePosition ?? first.entry.functionName.filePosition).file) {
        //         functionTicks = snapshot.map
        //     }
        // }

        // const [overallQ1, overallQ2, overallQ3] = decorationGroup.value.overallQuartiles;
        // const [fileQ1, fileQ2, fileQ3] = decorationGroup.value.fileQuartiles ??= quartiles(snapshot.map(({ selfTime }) => selfTime).sort((a, b) => a - b));
        // for (let i = decorationGroup.count; i < snapshot.length; i++) {
        //     if (i === maxCount) {
        //         feature.state = EditorDecorationState.Partial;
        //         break;
        //     }
        //     if (uiOperationToken.isCancellationRequested) {
        //         feature.state = EditorDecorationState.Invalid;
        //         return;
        //     }

        //     const node = snapshot[i];
        //     const overallDecorationType =
        //         node.selfTime >= overallQ3 ? profileHeavyDecorationType :
        //         node.selfTime >= overallQ2 ? profileModerateDecorationType :
        //         node.selfTime >= overallQ1 ? profileLightDecorationType :
        //         profileMeagerDecorationType;
        //     const fileDecorationType =
        //         node.selfTime >= fileQ3 ? profileHeavyDecorationType :
        //         node.selfTime >= fileQ2 ? profileModerateDecorationType :
        //         node.selfTime >= fileQ1 ? profileLightDecorationType :
        //         profileMeagerDecorationType;

        //     const location = node
        //     const position = node.entry.
        // }

        // if (fileDecorations.showDecorations.includes(constants.ShowDecorations.Profiler)) {
        //     assert(profileSnapshot !== undefined);
        //     const fileDecorationGroup = fileDecorations.profile;
        //     const maxCount = fileDecorationGroup.count + DECORATION_CHUNK_SIZE;
        //     for (let i = fileDecorationGroup.count; i < profileSnapshot.nodes.length; i++) {
        //         if (i === maxCount) {
        //             fileDecorations.state = FileDecorationState.Partial;
        //             break;
        //         }
        //         if (token.isCancellationRequested) {
        //             fileDecorations.state = FileDecorationState.Invalid;
        //             return;
        //         }
        //         const { node, functionName, entry } = profileSnapshot.nodes[i];
        //         if (entry) {
        //             const overallDecorationKind =
        //                 node.selfTime >= profileSnapshot.overallColorScale.top1PercentSelfTime ? "profile-heavy" :
        //                 node.selfTime >= profileSnapshot.overallColorScale.top5PercentSelfTime ? "profile-moderate" :
        //                 node.selfTime >= profileSnapshot.overallColorScale.top10PercentSelfTime ? "profile-light" :
        //                 undefined;
        //             const fileColorScale = profileSnapshot.fileColorScale.get(functionName.filePosition.file);
        //             const fileDecorationKind = fileColorScale ?
        //                 node.selfTime >= fileColorScale.top1PercentSelfTime ? "profile-heavy" :
        //                 node.selfTime >= fileColorScale.top5PercentSelfTime ? "profile-moderate" :
        //                 node.selfTime >= fileColorScale.top10PercentSelfTime ? "profile-light" :
        //                 node.selfTime >= fileColorScale.top50PercentSelfTime ? "profile-moderate0-percent" :
        //                 undefined :
        //                 undefined;
        //             if (overallDecorationKind) {
        //                 const decorations = fileDecorationGroup.decorations[overallDecorationKind] ||= [];
        //                 const range = pickExtentLocation(entry, fileDecorations.file)?.range;
        //                 if (range) {
        //                     decorations.push({ range });
        //                 }
        //             }
        //             if (fileDecorationKind) {
        //                 const decorations = fileDecorationGroup.decorations[fileDecorationKind] ||= [];
        //                 const range = pickExtentLocation(entry, fileDecorations.file)?.range;
        //                 if (range) {
        //                     decorations.push({ range });
        //                 }
        //             }
        //         }
        //         fileDecorationGroup.count++;
        //         if ((++spinCounter % 100) === 0) {
        //             await delay(10);
        //         }
        //     }
        // }
    }

    private async _fillLineTickDecorations(editor: TextEditor, decorationsMap: Map<TextEditorDecorationType, RangeMap<Range | DecorationOptions>>, snapshot: ProfileViewNodeSnapshot, token: CancellationToken) {
        const uri = unwrapScriptSource(editor.document.uri).uri;
        if (!uri) return;

        const fileUri = getCanonicalUri(uri);

        const lineTicks = snapshot.tryGetMappedLineTicks() ?? await snapshot.getMappedLineTicksAsync(token)
        if (!lineTicks || token.isCancellationRequested) return;

        const fileLineTicks = lineTicks.filter(lineTick => UriEqualer.equals(lineTick.file, fileUri));
        const [q1, q2, q3] = quartiles(fileLineTicks.map(({ hitCount: hit_count }) => hit_count).sort((a, b) => a - b));

        const decorations =
            from(fileLineTicks)
            .orderByDescending(entry => entry.hitCount)
            .take(this._maxDecorations)
            .select(entry => ({ entry, type: this._getDecorationForFileLineTick(entry, q1, q2, q3) }))
            .select(({ type, entry }) => {
                const selfTime = entry.hitCount * snapshot.averageSampleDuration.inMillisecondsF();
                const percentOfFunction = selfTime * 100 / snapshot.selfTime;
                const percentOfProgram = selfTime * 100 / snapshot.profileDuration.inMillisecondsF();
                const position = new Position(entry.line - 1, 0);
                const range = new Range(position, position);
                const options: DecorationOptions = {
                    range,
                    hoverMessage: markdown`${[
                        markdown`Hit count: ${entry.hitCount}  \n`,
                        markdown`Self time: ${formatMilliseconds(selfTime)}  \n`,
                        markdown`Percent of function: ${percentOfFunction.toFixed(1)}%  \n`,
                        markdown`Percent of program: ${percentOfProgram.toFixed(1)}%`,
                    ]}`
                };
                return { type, options };
            })
            .groupBy(({ type }) => type, ({ options }) => options, (type, entries) => ({ type, entries: entries.toArray() }));
        
        for (const { type, entries } of decorations) {
            let rangeMap = decorationsMap.get(type);
            if (!rangeMap) decorationsMap.set(type, rangeMap = new RangeMap());
            for (const entry of entries) {
                rangeMap.set(entry.range, entry);
            }
        }
    }

    private _getDecorationForFileLineTick(entry: FileLineTick, q1: number, q2: number, q3: number) {
        return entry.hitCount >= q3 ? this._profileHeavyDecorationType :
            entry.hitCount >= q2 ? this._profileModerateDecorationType :
            entry.hitCount >= q1 ? this._profileLightDecorationType :
            this._profileMeagerDecorationType;
    }

    private async _showAsync() {
        if (!openedLog) return;
        try {
            this._cancelSource.cancel();
            this._cancelSource = new CancellationTokenSource();
            const token = this._cancelSource.token;
            const editorDecorations = new Map<TextEditor, Map<TextEditorDecorationType, RangeMap<Range | DecorationOptions>>>();
            const snapshot = currentProfileViewNodeSnapshot;
            for (const editor of getTextEditors(this._showProfilerDecorations)) {
                let decorationMap = editorDecorations.get(editor);
                if (!decorationMap) editorDecorations.set(editor, decorationMap = new Map());
                await this._fillProfilerDecorations(editor, decorationMap, token);
            }
            if (snapshot) {
                for (const editor of getTextEditors(this._showLineTickDecorations)) {
                    let decorationMap = editorDecorations.get(editor);
                    if (!decorationMap) editorDecorations.set(editor, decorationMap = new Map());
                    await this._fillLineTickDecorations(editor, decorationMap, snapshot, token);
                }
            }
            for (const [editor, decorationMap] of editorDecorations) {
                for (const [decorationType, ranges] of decorationMap) {
                    const entries: DecorationOptions[] = [];
                    for (const range of ranges.values()) {
                        entries.push(range instanceof Range ? { range } : range);
                    }
                    editor.setDecorations(decorationType, entries);
                }
            }
        }
        catch (e) {
            if (e instanceof CancellationError || e instanceof CancelError) {
                return;
            }

            error("An error occurred while showing profiler decorations:", e);
        }
    }

    update() {
        this._hide();
        this._showAsync();
    }

    [Disposable.dispose]() {
        this._disposables.dispose();
    }
}

export function activateProfilerDecorations(context: ExtensionContext) {
    const stack = new VSDisposableStack();
    stack.use(new ProfilerDecorations());
    return stack;
}
