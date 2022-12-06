// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ExtensionContext, Disposable } from "vscode";
import { activateReportWebview } from "./report";
import { activateFunctionHistoryWebview } from "./functionHistory";
import { activateLogOverviewWebview } from "./logOverview";

export function activateWebviews(context: ExtensionContext) {
    return Disposable.from(
        activateReportWebview(context),
        activateFunctionHistoryWebview(context),
        activateLogOverviewWebview(context)
    );
}