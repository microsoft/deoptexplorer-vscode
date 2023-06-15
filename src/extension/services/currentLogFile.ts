// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Deferred } from "@esfx/async-deferred";
import { delay } from "@esfx/async-delay";
import { assert } from "#core/assert.js";
import { ImmutableEnumSet } from "#core/collections/enumSet.js";
import { readLines, tryStatAsync } from "#core/fs.js";
import { UriEqualer } from "#core/uri.js";
import { equateNullable } from "#core/utils.js";
import { CppEntriesProvider } from "#v8/tools/cppEntriesProvider.js";
import { CancellationError, CancellationToken, Disposable, ExtensionContext, ProgressLocation, Uri, window, workspace } from "vscode";
import { WindowsCppEntriesProvider } from "../../platforms/win32/windowsCppEntriesProvider";
import { LogProcessor } from "../components/logProcessor";
import * as constants from "../constants";
import { Entry } from "../model/entry";
import { LogFile } from "../model/logFile";
import { measureAsync } from "../outputChannel";
import { VSDisposableStack } from "../vscode/disposable";
import { LocationEqualer, parseLocation } from "../vscode/location";
import { scaleProgress } from "../vscode/progress";
import { getCanonicalLocation, getCanonicalUri } from "./canonicalPaths";
import { setLogStatus, setShowDecorations } from "./context";
import { emitters } from "./events";
import { cancelPendingOperations, cancelPendingUIOperation } from "./operationManager";
import * as storage from "./storage";

export let openedFile: Uri | undefined;
export let openedLog: LogFile | undefined;

let currentContext: ExtensionContext | undefined;
// let debugSession: DebugSession | undefined;

let waitForLogResolved = false;
let waitForLogDeferred = new Deferred<LogFile>();

export async function openLogFile(uri: Uri | undefined) {
    assert(currentContext !== undefined);

    cancelPendingUIOperation();

    // If a file wasn't provided, prompt for one.
    if (!uri) {
        const files = await window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { "V8 Logs": ["log"] }
        });
        if (files === undefined || files.length === 0) return;
        uri = files[0];
    }

    await openLogFileWorker(uri);
}

async function openLogFileWorker(uri: Uri) {
    let ok = false;
    try {
        closeLogFile();

        // Set log status and hide all decorations.
        await Promise.all([
            setLogStatus(constants.LogStatus.Opening),
            setShowDecorations(ImmutableEnumSet.empty())
        ]);

        // signal that a log file will be opened and wait a short delay for UI updates
        emitters.willOpenLogFile({ uri });
        await delay(100);

        // read in the log file with progress reporting
        openedLog = await measureAsync("parse log file", () => window.withProgress({
            title: constants.extensionName,
            location: ProgressLocation.Notification,
            cancellable: true
        }, async (progress, token) => {
            progress.report({ message: "Processing log..." });

            // Get the canonical URI for the file
            const file = getCanonicalUri(uri);

            // Try to load a native CppEntriesProvider on Windows
            let cppEntriesProvider: CppEntriesProvider | undefined;
            if (process.platform === "win32") {
                cppEntriesProvider = new WindowsCppEntriesProvider({
                    globalStorageUri: currentContext?.globalStorageUri,
                    extensionUri: currentContext?.extensionUri,
                });
            }

            // Read the log
            const processor = new LogProcessor({
                excludeNatives: !workspace.getConfiguration("deoptexplorer").get("includeNatives", false),
                globalStorageUri: currentContext?.globalStorageUri,
                cppEntriesProvider,
            });
            const stats = await tryStatAsync(file);
            const log = await processor.process(
                readLines(file),
                scaleProgress(progress, 0.6),
                token,
                stats?.size || undefined);
            if (token.isCancellationRequested) return;

            // // Start a debugger
            // await debug.startDebugging(undefined, {
            //     type: constants.extensionName,
            //     request: "attach",
            //     name: "Deopt Explorer",
            // }, {
            //     suppressDebugStatusbar: true,
            //     suppressDebugToolbar: true,
            //     suppressDebugView: true,
            //     suppressSaveBeforeStart: true,
            // });

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
        // if (debug.activeDebugSession?.type === constants.extensionName) {
        //     debug.stopDebugging();
        // }

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
    const stack = new VSDisposableStack();

    currentContext = context;
    stack.defer(() => { currentContext = undefined; });

    // stack.use(debug.onDidStartDebugSession(session => {
    //     if (session.type === constants.debuggerType) {
    //         if (debugSession) {
    //             debug.stopDebugging(debugSession);
    //         }
    //         debugSession = session;
    //     }
    // }));

    // stack.use(debug.onDidTerminateDebugSession(session => {
    //     if (session === debugSession) {
    //         debugSession = undefined;
    //     }
    // }));

    stack.defer(closeLogFile);
    return stack;
}
