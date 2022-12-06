// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import { FunctionState, isOptimizedFunctionState } from "../../../third-party-derived/v8/enums/functionState";
import { LogFile } from "../../model/logFile";
import { html } from "../../../core/html";
import { equateNullable } from "../../../core/utils";
import { renderLinkToFile } from "../utils";
import { UriEqualer } from "../../../core/uri";

export function renderDeoptimizedFunctions(log: LogFile, topCount: number) {
    return html`
    <section style="margin-right:10px;">
        <h2>Top ${topCount} Deoptimized Functions</h2>
        <summary>Optimized functions that have been deoptimized multiple times.</summary>
        <ol>${
            from(log.files)
                .selectMany(([file, fileEntry]) =>
                    from(fileEntry.functions)
                        .filter(entry => equateNullable(entry.referenceLocation?.uri, file, UriEqualer))
                        .select(func => ({ func, file, optimizedCount: from(func.updates).count(update => isOptimizedFunctionState(update.state)) })))
            .where(({ optimizedCount }) => optimizedCount > 1)
            .orderByDescending(({ optimizedCount }) => optimizedCount)
            .take(topCount)
            .select(({ func, file }) => html`
            <li>${renderLinkToFile(func.functionName, func.pickReferenceLocation(file))} (${from(func.updates).count(update => isOptimizedFunctionState(update.state))})</li>`)
            .defaultIfEmpty(html`<em>none found</em>`)
        }</ol>
    </section>`;
}
