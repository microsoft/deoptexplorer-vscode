// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { isFileSystemLocation } from "#core/paths.js";
import { Sources } from "#core/sources.js";
import { resolveUri } from "#core/uri.js";
import { TextEncoder } from "util";
import { Disposable, EventEmitter, ExtensionContext, FileChangeEvent, FileChangeType, FilePermission, FileStat, FileSystemError, FileSystemProvider, FileType, Location, Uri, workspace } from "vscode";
import * as constants from "../constants";
import { openedFile, openedLog } from "../services/currentLogFile";
import { events } from "../services/events";
import { VSDisposableStack } from "../vscode/disposable";

export type ScriptSource =
    | { uri?: Uri, scriptId: number }
    | { uri: Uri, scriptId?: undefined }
    ;

export function isOpenableScriptUri(uri: Uri, sources: Sources | undefined) {
    const resolution = sources?.getExistingResolution(uri);
    if (resolution?.result === "ok" && resolution.local) return true;
    if (isFileSystemLocation(uri)) return true;
    return !!sources?.getScript(uri);
}

function adjustUriToRemote(uri: Uri) {
    if (openedFile?.scheme !== "vscode-remote") return uri;
    if (uri.scheme === "vscode-remote") return uri;
    if (uri.scheme !== "file" || uri.authority) return uri;
    return resolveUri(openedFile, uri.path);
}

export function getScriptSourceUri(uri: Uri, sources: Sources | undefined) {
    const resolution = sources?.getExistingResolution(uri);
    if (resolution?.result === "ok" && resolution.local) return adjustUriToRemote(uri);
    const script = sources?.getScript(uri);
    if (script) return wrapScriptSource(script);
    if (isFileSystemLocation(uri)) return adjustUriToRemote(uri);
}

export function getScriptSourceLocation(location: Location, sources: Sources | undefined) {
    const uri = getScriptSourceUri(location.uri, sources);
    return uri === location.uri ? location :
        uri ? new Location(uri, location.range) :
        undefined;
}

export function wrapScriptSource(source: ScriptSource) {
    if (source.scriptId && source.scriptId > 0) {
        let path = "";
        const query = new URLSearchParams();
        query.set("scriptId", `${source.scriptId}`);
        if (source.uri) {
            query.set("uri", source.uri.toString(/*skipEncoding*/ false));
            switch (source.uri.scheme) {
                case "file":
                case "vscode-remote":
                case "https":
                case "http":
                case "node":
                    path = source.uri.path;
                    break;
                default:
                    path = `/${encodeURIComponent(source.uri.toString(/*skipEncoding*/ true))}`;
                    break;
            }
        }
        return Uri.from({
            scheme: constants.schemes.source,
            path,
            query: query.toString()
        });
    }
    else if (source.uri) {
        return adjustUriToRemote(source.uri);
    }
    else {
        throw new Error("Invalid source");
    }
}

export function unwrapScriptSource(uri: Uri): ScriptSource {
    if (uri.scheme !== constants.schemes.source) return { uri };
    const query = new URLSearchParams(uri.query);
    const scriptIdString = query.get("scriptId");
    if (scriptIdString === null) throw new Error("Invalid source");
    const scriptId = parseInt(scriptIdString, 10);
    const scriptUriString = query.get("uri");
    const scriptUri = scriptUriString ? Uri.parse(scriptUriString, /*strict*/ true) : undefined;
    return { uri: scriptUri, scriptId: scriptId };
}

export class ScriptSourceFileSystemProvider implements FileSystemProvider {
    private didChangeFile = new EventEmitter<FileChangeEvent[]>();
    readonly onDidChangeFile = this.didChangeFile.event;

    watch(uri: Uri, options: { readonly recursive: boolean; readonly excludes: readonly string[]; }): Disposable {
        if (options.recursive) return new Disposable(() => { });
        const stack = new VSDisposableStack();
        stack.use(events.onDidCloseLogFile(() => this.didChangeFile.fire([{ type: FileChangeType.Deleted, uri }])));
        stack.use(events.onDidOpenLogFile(() => this.didChangeFile.fire([{ type: FileChangeType.Deleted, uri }])));
        return stack;
    }

    stat(uri: Uri): FileStat | Thenable<FileStat> {
        const source = unwrapScriptSource(uri);
        const exists =
            source.scriptId && source.scriptId > 0 ? openedLog?.sources.hasScriptId(source.scriptId) :
            source.uri ? openedLog?.sources.has(source.uri) :
            false;

        if (exists) {
            return {
                ctime: 0,
                mtime: 0,
                size: 0,
                type: FileType.File,
                permissions: FilePermission.Readonly,
            };
        }

        throw FileSystemError.FileNotFound(uri);
    }

    readFile(uri: Uri): Uint8Array | Thenable<Uint8Array> {
        const source = unwrapScriptSource(uri);
        const text =
            source.scriptId && source.scriptId > 0 ? openedLog?.sources.getScriptById(source.scriptId)?.text :
            source.uri ? openedLog?.sources.getExistingContent(source.uri) :
            undefined;

        if (text !== undefined) {
            const encoder = new TextEncoder();
            return encoder.encode(text);
        }

        throw FileSystemError.FileNotFound(uri);
    }

    readDirectory(uri: Uri): never {
        throw FileSystemError.FileNotFound(uri);
    }

    createDirectory(uri: Uri): never {
        throw FileSystemError.NoPermissions(uri);
    }

    writeFile(uri: Uri): never {
        throw FileSystemError.NoPermissions(uri);
    }

    delete(uri: Uri): never {
        throw FileSystemError.NoPermissions(uri);
    }

    rename(uri: Uri): never {
        throw FileSystemError.NoPermissions(uri);
    }
}

let provider: ScriptSourceFileSystemProvider;

export function activateScriptsFileSystemProvider(context: ExtensionContext) {
    provider = new ScriptSourceFileSystemProvider();
    return Disposable.from(
        workspace.registerFileSystemProvider(constants.schemes.source, provider, { isCaseSensitive: true, isReadonly: true }),
    );
}
