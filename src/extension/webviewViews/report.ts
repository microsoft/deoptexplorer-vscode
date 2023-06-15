// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from "path";
import { Disposable, ExtensionContext, Location, Position, Range, Uri, ViewColumn, Webview, WebviewPanel, window } from "vscode";
import { LogFile } from "../model/logFile";
import * as constants from "../constants";
import { html } from "#core/html.js";
import { openedFile, openedLog } from "../services/currentLogFile";
import { events } from "../services/events";
import { createNonce } from "../utils/csp";
import { typeSafeExecuteCommand } from "../vscode/commands";
import { renderDeoptimizedFunctions } from "./reportParts/partDeoptimizedFunctions";
import { renderFunctionsBySelfTime } from "./reportParts/partFunctionsBySelfTime";
import { renderLinkToFile } from "./utils";

const TOP_COUNT = 15;
let currentContext: ExtensionContext | undefined;
let currentTitle: string | undefined;
let currentContent: string | undefined;
let reportView: WebviewPanel | undefined;
let reportViewOnDidDisposeSubscription: Disposable | undefined;
let reportViewOnDidReceiveMessageSubscription: Disposable | undefined;

function generateOpenLogReportViewContent(file: Uri, log: LogFile) {
    try {
        return html`
        <h1>Deoptimization Report</h1>
        <ul>
            <li>V8 Version: ${log.version} (${log.version.toFullString()})</li>
            <li>Log: ${renderLinkToFile(path.basename(file.fsPath), new Location(file, new Position(0, 0)))}</li>
        </ul>
        <div style="display:flex;flex-direction:row;flex-wrap:wrap;">
            ${renderDeoptimizedFunctions(log, TOP_COUNT)}
            ${renderFunctionsBySelfTime(log, TOP_COUNT)}
        </div>
        `;
    }
    catch (e: any) {
        return html`
        <h1>An error occurred:</h1>
        <pre>${e.stack}</pre>
        `;
    }
}

function generateReportViewHtml(context: ExtensionContext, webview: Webview) {
    const scriptUri = Uri.file(context.asAbsolutePath("resources/scripts/report.js"));
    const nonce = createNonce();
    return html`<!DOCTYPE html>
<html lang="en">
<head>
    <meta http-equiv="Content-Security-Policy" content="
        default-src 'none';
        img-src ${webview.cspSource} https: 'self' data:;
        script-src 'nonce-${nonce}';
        style-src ${webview.cspSource} 'unsafe-inline';
    ">
    <meta name="viewport" content="width=device-width, initial-scale: 1.0">
</head>
<body>
${openedLog && openedFile ? generateOpenLogReportViewContent(openedFile, openedLog) : "No open log."}
<script nonce="${nonce}" src="${webview.asWebviewUri(scriptUri)}"></script>
</body>
</html>`.toString();
}

export function showReportView(showOptions: ViewColumn | { viewColumn: ViewColumn, preserveFocus?: boolean } = ViewColumn.Active) {
    if (!reportView) {
        const view = reportView = window.createWebviewPanel(
            constants.webviews.reportView,
            "Deoptimization Report",
            showOptions,
            {
                enableCommandUris: true,
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        reportViewOnDidReceiveMessageSubscription = view.webview.onDidReceiveMessage(e => {
            if (e.command === "openFile") {
                typeSafeExecuteCommand("vscode.open", Uri.file(e.file), {
                    preview: true,
                    selection: new Range(e["start-line"], e["start-character"], e["end-line"], e["end-character"])
                });
            }
        });
        reportViewOnDidDisposeSubscription = reportView.onDidDispose(() => {
            if (reportView === view) {
                currentTitle = undefined;
                currentContent = undefined;
                reportView = undefined;
                reportViewOnDidDisposeSubscription = undefined;
            }
        });
    }
    else {
        const viewColumn = typeof showOptions === "object" ? showOptions.viewColumn : showOptions;
        const preserveFocus = typeof showOptions === "object" ? showOptions.preserveFocus : undefined;
        reportView.reveal(viewColumn, preserveFocus);
    }

    updateReportView();
}

function updateReportView() {
    if (reportView) {
        if (!currentTitle || !currentContent) {
            currentTitle = openedFile ? `Deoptimization Report: ${path.basename(openedFile.fsPath)}` : "Deoptimization Report";
            currentContent = currentContext ? generateReportViewHtml(currentContext, reportView.webview) : "";
        }
        if (reportView.title !== currentTitle) {
            reportView.title = currentTitle;
        }
        if (reportView.webview.html !== currentContent) {
            reportView.webview.html = currentContent;
        }
    }
}

function destroy() {
    reportViewOnDidReceiveMessageSubscription?.dispose();
    reportViewOnDidReceiveMessageSubscription = undefined;
    reportViewOnDidDisposeSubscription?.dispose();
    reportViewOnDidDisposeSubscription = undefined;
    reportView?.dispose();
    reportView = undefined;
    currentContext = undefined;
    currentTitle = undefined;
    currentContent = undefined;
}

export function activateReportWebview(context: ExtensionContext) {
    currentContext = context;
    return Disposable.from(
        new Disposable(destroy),
        events.onDidOpenLogFile(() => {
            currentTitle = undefined;
            currentContent = undefined;
            updateReportView();
        }),
        events.onDidCloseLogFile(() => {
            currentTitle = undefined;
            currentContent = undefined;
            reportView?.dispose();
            reportView = undefined;
            updateReportView();
        })
    );
}
