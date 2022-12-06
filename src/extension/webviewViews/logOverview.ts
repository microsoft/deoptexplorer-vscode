// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Deferred } from "@esfx/async-deferred";
import * as path from "path";
import { CancellationToken, Disposable, ExtensionContext, Uri, WebviewView, WebviewViewProvider, WebviewViewResolveContext, window } from "vscode";
import { colors } from "../utils/colors";
import { CommandUri } from "../vscode/commandUri";
import { LogFile } from "../model/logFile";
import * as constants from "../constants";
import { html } from "../../core/html";
import { formatMillisecondsShort } from "../formatting/numbers";
import { pieChart, pieChartStyleResource, Slice } from "../../third-party-derived/chromium/pieChart";
import { events } from "../services/events";
import { createNonce } from "../utils/csp";

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
            const slices: Slice[] = [
                { value: profile.totalProgramTime.inMillisecondsF(), title: "Program", color: colors[0] },
                { value: profile.totalIdleTime.inMillisecondsF(), title: "Idle", color: colors[1] },
                { value: profile.totalGcTime.inMillisecondsF(), title: "GC", color: colors[2] },
                { value: profile.totalFunctionTime.inMillisecondsF(), title: "Scripting", color: colors[3] },
            ];
            slices.sort((a, b) => b.value - a.value);

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
                        <p style="margin-top: 12px; margin-bottom: 12px;"><a title="Show Report" href="${new CommandUri(constants.commands.log.showReport)}">Show Report</a></p>
                        <p>${pieChart(slices, { size: 150, formatter: formatMillisecondsShort, cutout: true, legend: true })}</p>
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
