// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { TextEncoder } from "util";
import { Disposable, EventEmitter, ExtensionContext, FileChangeEvent, FileChangeType, FilePermission, FileStat, FileSystemError, FileSystemProvider, FileType, Location, Uri, workspace } from "vscode";
import * as constants from "../constants";
import { openedLog } from "../services/currentLogFile";
import { events } from "../services/events";
import { VSDisposableStack } from "../vscode/disposable";
import { Sources } from "../../core/sources";

export type ScriptSource =
    | { uri?: Uri, scriptId: number }
    | { uri: Uri, scriptId?: undefined }
    ;

export function isOpenableScriptUri(uri: Uri, sources: Sources | undefined) {
    if (uri.scheme === "file") return true;
    return !!sources?.getScript(uri);
}

export function getScriptSourceUri(uri: Uri, sources: Sources | undefined) {
    const script = sources?.getScript(uri);
    return script ? wrapScriptSource(script) :
        uri.scheme === "file" ? uri :
        undefined;
}

export function getScriptSourceLocation(location: Location, sources: Sources | undefined) {
    const uri = getScriptSourceUri(location.uri, sources);
    return uri === location.uri ? location :
        uri ? new Location(uri, location.range) :
        undefined;
}

export function wrapScriptSource(source: ScriptSource) {
    if (source.scriptId && source.scriptId > 0) {
        return Uri.from({
            scheme: constants.schemes.source,
            path: `/${source.uri ? encodeURIComponent(source.uri.toString(/*skipEncoding*/ true)) : ""}`,
            query: `scriptId=${source.scriptId}`
        });
    }
    else if (source.uri) {
        return source.uri;
    }
    else {
        throw new Error("Invalid source");
    }
}

export function unwrapScriptSource(uri: Uri): ScriptSource {
    if (uri.scheme !== constants.schemes.source) return { uri };

    const scriptIdString = /^scriptId=(?<scriptIdString>\d+)$/.exec(uri.query)?.[1];
    if (scriptIdString === undefined) throw new Error("Invalid source");

    const uriString = uri.path.length > 1 ? decodeURIComponent(uri.path.slice(1)) : undefined;
    const scriptId = parseInt(scriptIdString, 10);
    const scriptUri = uriString ? Uri.parse(uriString, /*strict*/ true) : undefined;
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
