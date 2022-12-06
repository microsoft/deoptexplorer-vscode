// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import { FunctionName } from "../../model/functionName";
import { formatFunctionState } from "../../../third-party-derived/v8/enums/functionState";
import { LogFile } from "../../model/logFile";
import { ViewBuilder } from "../../../third-party-derived/v8/tools/profile_view";
import { ProfileShowMode } from "../../constants";
import { html } from "../../../core/html";
import { formatMilliseconds } from "../../formatting/numbers";
import { isIgnoredFile } from "../../services/canonicalPaths";
import { renderLinkToFile } from "../utils";

export function renderFunctionsByTotalTime(log: LogFile, topCount: number) {
    const callTree = log.profile.getTopDownProfile();
    const viewBuilder = new ViewBuilder(log.profile.averageSampleDuration.inMillisecondsF());
    const view = viewBuilder.buildView(callTree, ProfileShowMode.Flat);

    return html`
    <section style="margin-right:10px;">
    <h2>Top ${topCount} Functions by Total Time</h2>
    <summary>Includes time spent calling other functions.</summary>
    <ol>${
        from(view.head.children)
            .select(node => ({
                node,
                functionName: FunctionName.parse(node.internalFuncName)
            }))
            .where(({ functionName }) => !!functionName.filePosition && !isIgnoredFile(functionName.filePosition.uri))
            .orderByDescending(({ node }) => node.totalTime)
            .thenBy(({ functionName }) => functionName.name)
            .take(topCount)
            .select(({ node, functionName }) => ({ node, functionName, entry: log.findFunctionEntryByFunctionName(functionName) }))
            .select(({ node, functionName, entry }) => html`<li>${entry?.referenceLocation ? renderLinkToFile(functionName.name, entry.referenceLocation) : functionName.name} (${formatMilliseconds(node.totalTime)}) [${functionName.state ? formatFunctionState(functionName.state) : "External"}]</li>`)
            .defaultIfEmpty(html`<em>none found</em>`)
    }</ol>
    </section>
    `;
}
