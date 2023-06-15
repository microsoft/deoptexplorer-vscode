// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Deferred } from "@esfx/async-deferred";
import { from } from "@esfx/iter-query";
import { pieChart, pieChartStyleResource, Slice } from "#chromium/pieChart.js";
import { html } from "#core/html.js";
import * as path from "path";
import { CancellationToken, Disposable, ExtensionContext, Uri, WebviewView, WebviewViewProvider, WebviewViewResolveContext, window } from "vscode";
import * as constants from "../constants";
import { formatMemory, formatMemoryHighPrecision, formatMillisecondsShort } from "../formatting/numbers";
import { LogFile } from "../model/logFile";
import { events } from "../services/events";
import { colors, getColor } from "../utils/colors";
import { createNonce } from "../utils/csp";
import { CommandUri } from "../vscode/commandUri";

const SHOW_MEMORY_BREAKDOWN = false;

// <logfile>
// - Show Report

class OverviewWebviewViewProvider implements WebviewViewProvider {
    private _extensionUri: Uri;
    private _openedLog: LogFile | undefined;
    private _openedFile: Uri | undefined;
    private _webviewView: WebviewView | undefined;
    private _waitForLog = new Deferred<void>();

    constructor(extensionUri: Uri) {
        this._extensionUri = extensionUri;
    }

    openingLog(file: Uri) {
        this._openedFile = file;
        this._openedLog = undefined;
        this.refreshWebview();
    }

    openLog(file: Uri, log: LogFile) {
        this._openedFile = file;
        this._openedLog = log;
        this.refreshWebview();
        this._waitForLog.resolve();
    }

    closeLog() {
        this._openedFile = undefined;
        this._openedLog = undefined;
        this._waitForLog = new Deferred();
        this.refreshWebview();
    }

    private refreshWebview() {
        if (!this._webviewView) return;
        const title = this._openedFile ? path.basename(this._openedFile.fsPath) : "Log";
        this._webviewView.title = title;
        const webview = this._webviewView.webview;
        if (!this._openedLog) {
            webview.html = "";
        }
        else {
            const nonce = createNonce();
            const scriptOverviewUri = webview.asWebviewUri(Uri.joinPath(this._extensionUri, "resources", "scripts", "overview.js"));
            const styleResetUri = webview.asWebviewUri(Uri.joinPath(this._extensionUri, "resources", "styles", "reset.css"));
            const styleVSCodeUri = webview.asWebviewUri(Uri.joinPath(this._extensionUri, "resources", "styles", "vscode.css"));
            const styleOverviewUri = webview.asWebviewUri(Uri.joinPath(this._extensionUri, "resources", "styles", "overview.css"));
            const codiconsUri = webview.asWebviewUri(Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
            const codiconsFontUri = webview.asWebviewUri(Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.ttf'));
            const pieChartStyleUri = webview.asWebviewUri(Uri.joinPath(this._extensionUri, pieChartStyleResource));
            const profile = this._openedLog.profile;
            const timeSlices: Slice[] = [
                { value: profile.totalProgramTime.inMillisecondsF(), title: "Program", color: colors[0] },
                { value: profile.totalIdleTime.inMillisecondsF(), title: "Idle", color: colors[1] },
                { value: profile.totalGcTime.inMillisecondsF(), title: "GC", color: colors[2] },
                { value: profile.totalFunctionTime.inMillisecondsF(), title: "Scripting", color: colors[3] },
            ];
            timeSlices.sort((a, b) => b.value - a.value);

            const entryCategories = from(this._openedLog.memory.entrySizes.values())
                .orderBy(c => c.name)
                .toArray();

            let totalEntrySize = 0;
            const memorySlices: Slice[] = [];
            for (const memoryCategory of entryCategories) {
                totalEntrySize += memoryCategory.size;
                memorySlices.push({ value: memoryCategory.size, title: memoryCategory.name, color: getColor(4 + memorySlices.length) });
            }

            memorySlices.push({ value: this._openedLog.memory.size - totalEntrySize, title: "Other", color: getColor(4 + memorySlices.length) });
            memorySlices.sort((a, b) => b.value - a.value);

            webview.html = html`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8" />
                    <meta http-equiv="Content-Security-Policy" content="
                        default-src 'none';
                        img-src ${webview.cspSource} https: 'self' data:;
                        style-src ${webview.cspSource} ${codiconsUri} 'unsafe-inline';
                        font-src ${codiconsFontUri};
                        script-src 'nonce-${nonce}';
                    ">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <link href="${styleResetUri}" rel="stylesheet" />
                    <link href="${styleVSCodeUri}" rel="stylesheet" />
                    <link href="${styleOverviewUri}" rel="stylesheet" />
                    <link href="${codiconsUri}" rel="stylesheet" />
                    <link href="${pieChartStyleUri}" rel="stylesheet" />
                    <title>${title}</title>
                </head>
                <body>
                    <div class="message">
                        <p>V8 Version: ${this._openedLog.version} (${this._openedLog.version.toFullString()})</p>
                        <p>Execution Time: ${formatMillisecondsShort(this._openedLog.profile.duration.inMillisecondsF())}</p>
                        <p>Memory Usage: ${formatMemoryHighPrecision(this._openedLog.memory.size)}</p>
                        <p style="margin-top: 12px; margin-bottom: 12px;"><a title="Show Report" href="${new CommandUri(constants.commands.log.showReport)}">Show Report</a></p>
                        <p><b>Time</b></p>
                        <p>${pieChart(timeSlices, { size: 150, formatter: formatMillisecondsShort, cutout: true, legend: true })}</p>
                        ${SHOW_MEMORY_BREAKDOWN ? html`
                        <p style="margin-top: 12px"><b>Memory Usage</b> (breakdown is approximate)</p>
                        <p>${pieChart(memorySlices, { size: 150, formatter: formatMemory, cutout: true, legend: true })}</p>
                        ` : ""}
                    </div>
                    <script nonce="${nonce}" src="${scriptOverviewUri}"></script>
                </body>
                </html>
            `.toString();
        }
    }

    async resolveWebviewView(webviewView: WebviewView, context: WebviewViewResolveContext<unknown>, token: CancellationToken) {
        webviewView.webview.options = {
            enableScripts: true,
            enableCommandUris: true,
            localResourceRoots: [this._extensionUri]
        };
        this._webviewView = webviewView;
        this.refreshWebview();
        await Promise.race([
            new Promise<void>(resolve => token.onCancellationRequested(resolve)),
            this._waitForLog.promise
        ]);
    }
}

export function activateLogOverviewWebview(context: ExtensionContext) {
    const overviewProvider = new OverviewWebviewViewProvider(context.extensionUri);
    return Disposable.from(
        window.registerWebviewViewProvider(constants.webviews.logOverviewView, overviewProvider, { }),
        events.onWillOpenLogFile(({ uri }) => { overviewProvider.openingLog(uri); }),
        events.onDidOpenLogFile(({ uri, log }) => { overviewProvider.openLog(uri, log); }),
        events.onDidCloseLogFile(() => { overviewProvider.closeLog(); }),
    );
}
