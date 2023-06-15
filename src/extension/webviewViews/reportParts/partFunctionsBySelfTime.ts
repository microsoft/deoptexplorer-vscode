// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import { html } from "#core/html.js";
import { formatFunctionState } from "#v8/enums/functionState.js";
import { ViewBuilder } from "#v8/tools/profile_view.js";
import { ProfileShowMode } from "../../constants";
import { isOpenableScriptUri } from "../../fileSystemProviders/scriptSourceFileSystemProvider";
import { formatMilliseconds } from "../../formatting/numbers";
import { FunctionName } from "../../model/functionName";
import { LogFile } from "../../model/logFile";
import { renderLinkToFile } from "../utils";

export function renderFunctionsBySelfTime(log: LogFile, topCount: number) {
    const callTree = log.profile.getTopDownProfile();
    const viewBuilder = new ViewBuilder(log.profile.averageSampleDuration.inMillisecondsF());
    const view = viewBuilder.buildView(callTree, ProfileShowMode.Flat);

    return html`
    <section style="margin-right:10px;">
    <h2>Top ${topCount} Functions by Self Time</h2>
    <summary>Excludes time spent calling other functions.</summary>
    <ol>${
        from(view.head.children)
            .select(node => ({
                node,
                functionName: FunctionName.parse(node.internalFuncName)
            }))
            .where(({ functionName }) => !!functionName.filePosition && isOpenableScriptUri(functionName.filePosition.uri, log.sources))
            .orderByDescending(({ node }) => node.selfTime)
            .thenBy(({ functionName }) => functionName.name)
            .take(topCount)
            .select(({ node, functionName }) => ({ node, functionName, entry: log.findFunctionEntryByFunctionName(functionName) }))
            .select(({ node, functionName, entry }) => html`<li>${entry?.referenceLocation ? renderLinkToFile(functionName.name, entry.referenceLocation, { linkSources: log.sources }) : functionName.name} (${formatMilliseconds(node.selfTime)}) [${functionName.state ? formatFunctionState(functionName.state) : "External"}]</li>`)
            .defaultIfEmpty(html`<em>none found</em>`)
    }</ol>
    </section>
    `;
}
