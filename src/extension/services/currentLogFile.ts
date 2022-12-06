// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Deferred } from "@esfx/async-deferred";
import { CancellationError, CancellationToken, Disposable, ExtensionContext, ProgressLocation, Uri, window, workspace } from "vscode";
import { assert } from "../../core/assert";
import { LogProcessor } from "../components/logProcessor";
import { Entry } from "../model/entry";
import { LogFile } from "../model/logFile";
import * as constants from "../constants";
import { measureAsync } from "../outputChannel";
import { equateNullable } from "../../core/utils";
import { readLines, tryStatAsync } from "../../core/fs";
import { LocationEqualer, parseLocation } from "../vscode/location";
import { scaleProgress } from "../vscode/progress";
import { getCanonicalLocation, getCanonicalUri } from "./canonicalPaths";
import { setLogStatus, setShowDecorations } from "./context";
import { emitters } from "./events";
import { cancelPendingOperations, cancelPendingUIOperation } from "./operationManager";
import * as storage from "./storage";
import { UriEqualer } from "../../core/uri";
import { delay } from "@esfx/async-delay";

export let openedFile: Uri | undefined;
export let openedLog: LogFile | undefined;

let currentContext: ExtensionContext | undefined;

let waitForLogResolved = false;
let waitForLogDeferred = new Deferred<LogFile>();

export async function openLogFile(uri: Uri | undefined, force: boolean) {
    assert(currentContext !== undefined);
    let uriIn = uri;
    let ok = false;
    try {
        cancelPendingUIOperation();

        if (!uriIn) {
            const files = await window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: { "V8 Logs": ["log"] }
            });
            if (files === undefined || files.length === 0) return;
            uriIn = files[0];
        }

        const uri = uriIn;
        closeLogFile();
        await Promise.all([
            setLogStatus(constants.LogStatus.Opening),
            setShowDecorations([])
        ]);
        emitters.willOpenLogFile({ uri });
        await delay(100);

        openedLog = await measureAsync("parse log file", () => window.withProgress({
            title: constants.extensionName,
            location: ProgressLocation.Notification,
            cancellable: true
        }, async (progress, token) => {
            const file = getCanonicalUri(uri);

            progress.report({ message: "Processing log..." });

            const processor = new LogProcessor({
                excludeNatives: !workspace.getConfiguration("deoptexplorer").get("includeNatives", false),
                globalStorageUri: currentContext?.globalStorageUri
            });
            const stats = await tryStatAsync(file);
            const log = await processor.process(readLines(file), scaleProgress(progress, 0.6), token, stats?.size || undefined);
            if (token.isCancellationRequested) return;

            progress.report({ increment: 100, message: "Log parsed" });
            return log;
        }));

        if (openedLog) {
            openedFile = uri;
            emitters.didOpenLogFile({ uri, log: openedLog });

            const recentFiles = storage.getRecentFiles();
            const index = recentFiles.findIndex(recent => UriEqualer.equals(recent, uri));

            let recentFilesPromise: Promise<void> | undefined;
            if (index !== 0) {
                if (index !== -1) {
                    recentFiles.splice(index, 1);
                    recentFiles.unshift(uri);
                }
                else {
                    recentFiles.unshift(uri);
                    if (recentFiles.length > 5) {
                        recentFiles.pop();
                    }
                }
                recentFilesPromise = storage.setRecentFiles(recentFiles);
            }

            await Promise.all([
                recentFilesPromise,
                setLogStatus(constants.LogStatus.Open),
                setShowDecorations(constants.kDefaultShowDecorations)
            ]);
            waitForLogResolved = true;
            waitForLogDeferred.resolve(openedLog);
            ok = true;
        }
    }
    finally {
        if (!ok) {
            emitters.didFailOpenLogFile();
            closeLogFile();
            await setLogStatus(constants.LogStatus.Closed);
        }
    }
}

export function waitForLog(token?: CancellationToken) {
    if (!token) return waitForLogDeferred.promise;

    let subscription: Disposable | undefined;
    const cancelPromise = new Promise<LogFile>((_, reject) => subscription = token.onCancellationRequested(() => reject(new CancellationError())));
    return Promise.race([cancelPromise, waitForLogDeferred.promise]).finally(() => {
        subscription?.dispose();
        subscription = undefined;
    });
}

export function closeLogFile() {
    if (openedFile) {
        emitters.didCloseLogFile({ uri: openedFile });
        cancelPendingOperations();
        openedFile = undefined;
        openedLog = undefined;
    }
    if (waitForLogResolved) {
        waitForLogDeferred = new Deferred();
        waitForLogResolved = false;
    }
    setLogStatus(constants.LogStatus.Closed);
}

export function getEntryId(entry: Entry) {
    return `${entry.kind}:${entry.filePosition}`;
}

export function findEntry(id: string) {
    if (openedLog) {
        const match = /^(ic|deopt|function):(.*)$/.exec(id);
        if (match) {
            const key = (match[1] + "s") as "ics" | "deopts" | "functions";
            const filePosition = getCanonicalLocation(parseLocation(match[2], /*strict*/ false));
            const fileEntry = openedLog.files.get(filePosition.uri);
            const entries = fileEntry?.[key] as Entry[] | undefined;
            return entries?.find(entry => equateNullable(filePosition, entry.filePosition, LocationEqualer));
        }
    }
}

export function activateCurrentLogFileService(context: ExtensionContext) {
    currentContext = context;
    return Disposable.from(
        new Disposable(() => {
            closeLogFile();
            currentContext = undefined;
        })
    );
}
