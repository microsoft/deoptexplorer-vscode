// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { getCanonicalUri, walkUpContainingDirectories } from "#extension/services/canonicalPaths.js";
import { fileUriToPath } from "#extension/vscode/uri.js";
import * as path from "path";
import * as ts from "typescript";
import { MessageItem, Uri, window, workspace } from "vscode";
import { StringMap } from "./collections/stringMap";
import { StringSet } from "./collections/stringSet";
import { readFileAsync, tryReadFileAsync } from "./fs";
import { LineMap } from "./lineMap";
import { isFileSystemLocation } from "./paths";
import { Script } from "./script";
import { extractSourceMappingURL, getInlineSourceMapData, SourceMap } from "./sourceMap";
import { ensureUriTrailingDirectorySeparator, relativeUriFragment, resolveUri, uriExtname } from "./uri";

export type OkLocalFileResolution = { readonly result: "ok", readonly local: true };
export type OkNonlocalFileResolution = { readonly result: "ok", readonly local: false };
export type OkFileResolution =
    | OkLocalFileResolution
    | OkNonlocalFileResolution
    ;

export type SkipFileResolution = { readonly result: "skip" };
export type RedirectFileResolution = { readonly result: "redirect", readonly file: Uri };
export type FileResolution =
    | OkFileResolution
    | SkipFileResolution
    | RedirectFileResolution
    ;

export type UserFileResolution =
    | SkipFileResolution
    | RedirectFileResolution
    ;

export type UserFileResolver = (file: Uri) => UserFileResolution | Promise<UserFileResolution>;

type MissingFileResolution = { readonly result: "missing" };

type RedirectTargetLocalFileResolution = { readonly result: "target", readonly from: StringSet<Uri>, readonly local: true };
type RedirectTargetNonlocalFileResolution = { readonly result: "target", readonly from: StringSet<Uri>, readonly local: false };
type RedirectTargetFileResolution =
    | RedirectTargetLocalFileResolution
    | RedirectTargetNonlocalFileResolution
    ;

type InternalFileResolution =
    | FileResolution
    | MissingFileResolution
    | RedirectTargetFileResolution;

const localFileOk: OkLocalFileResolution = Object.freeze({ result: "ok", local: true });
const nonlocalFileOk: OkNonlocalFileResolution = Object.freeze({ result: "ok", local: false });
const fileSkip: SkipFileResolution = Object.freeze({ result: "skip" as const });
const fileMissing: MissingFileResolution = Object.freeze({ result: "missing" as const });

const pickLocationItem: MessageItem = { title: "Find..." };
const ignoreFileItem: MessageItem = { title: "Skip", isCloseAffordance: true };
const ignoreAllFileItem: MessageItem = { title: "Skip all" };

interface DirectoryRedirection {
    readonly dirname: Uri;
    readonly originalFiles: StringSet<Uri>;
}

export class Sources {
    private _scriptUrlToScript = new StringMap<Uri, Script>(uriToString);
    private _scriptIdToScript = new Map<number, Script>();
    private _resolvedSources = new StringMap<Uri, string>(uriToString);
    private _resolvedLineMaps = new StringMap<Uri, LineMap>(uriToString);
    private _resolvedSourceFiles = new StringMap<Uri, ts.SourceFile>(uriToString);
    private _sourceMaps = new StringMap<Uri, SourceMap | Uri | "no-sourcemap">(uriToString);
    private _resolutions = new StringMap<Uri, InternalFileResolution>(uriToString);
    private _directoryRedirections = new StringMap<Uri, DirectoryRedirection>(uriToString);
    private _ignoreMissing = false;

    static readonly FILE_OK = nonlocalFileOk;
    static readonly FILE_SKIP = fileSkip;

    constructor(scripts?: Iterable<Script>) {
        if (scripts) {
            for (const script of scripts) {
                this.addScript(script);
            }
        }
    }

    // #region Scripts

    /**
     * Tests whether a {@link Script} was added for the provided id.
     */
    hasScriptId(scriptId: number) {
        return this._scriptIdToScript.has(scriptId);
    }

    /**
     * Tests whether a {@link Script} was added for the provided url.
     */
    hasScript(url: Uri) {
        if (this._scriptUrlToScript.has(url)) return true;
        const resolved = this._resolveFile(url);
        return resolved !== undefined && this._scriptUrlToScript.has(url);
    }

    getScriptById(scriptId: number) {
        return this._scriptIdToScript.get(scriptId);
    }

    getScript(url: Uri) {
        const script = this._scriptUrlToScript.get(url);
        if (script) return script;

        const resolved = this._resolveFile(url);
        return resolved && this._scriptUrlToScript.get(resolved);
    }

    getScriptId(url: Uri) {
        return this._scriptUrlToScript.get(url)?.scriptId;
    }

    getScriptUrl(scriptId: number) {
        return this._scriptIdToScript.get(scriptId)?.uri;
    }

    addScript(script: Script) {
        if (script.uri) this.delete(script.uri);
        this._scriptIdToScript.set(script.scriptId, script);
        if (script.uri) this._scriptUrlToScript.set(script.uri, script);
    }

    // #endregion

    // #region Sources

    has(file: Uri): boolean {
        return this._resolveFile(file) !== undefined;
    }

    private _resolveFile(file: Uri) {
        if (this._scriptUrlToScript.has(file)) {
            return file;
        }

        let resolution = this._resolutions.get(file);
        while (resolution?.result === "redirect") {
            file = resolution.file;
            resolution = this._resolutions.get(file);
        }

        if (resolution && isOkLike(resolution)) {
            return file;
        }
    }

    getExistingContent(file: Uri): string | undefined {
        const resolved = this._resolveFile(file);
        if (resolved !== undefined) {
            return this._getExistingContentWorker(resolved);
        }
    }

    private _getExistingContentWorker(resolved: Uri) {
        return this._scriptUrlToScript.get(resolved)?.text
            ?? this._resolvedSources.get(resolved);
    }

    async readAsync(file: Uri) {
        let resolved = this._resolveFile(file);
        if (resolved !== undefined) {
            return this._getExistingContentWorker(resolved);
        }

        await this.resolveAsync(file);

        resolved = this._resolveFile(file);
        if (resolved !== undefined) {
            return this._getExistingContentWorker(resolved);
        }
    }

    getExistingResolution(file: Uri): FileResolution | undefined {
        const resolution = this._getExistingResolutionWorker(file);
        return resolution && this._getFileResolution(resolution);
    }

    private _getExistingResolutionWorker(file: Uri): InternalFileResolution | undefined {
        const resolution = this._resolutions.get(file);
        if (resolution) return resolution;
        if (this._scriptUrlToScript.has(file)) return nonlocalFileOk;
    }

    async resolveAsync(file: Uri, onMissing?: UserFileResolver | "prompt"): Promise<FileResolution> {
        return this._tryResolveUsingExistingResolution(file, onMissing)
            || (await this._tryResolveUsingFileSystem(file))
            || (await this._tryResolveUsingDirectoryRedirection(file))
            || (await this._tryResolveUsingUiResolution(file, onMissing))
            || (await this._tryResolveUsingCustomResolution(file, onMissing))
            || this._recordSkipResolution(file, fileMissing);
    }

    private _tryResolveUsingExistingResolution(file: Uri, onMissing: UserFileResolver | "prompt" | undefined): FileResolution | undefined {
        const resolution = this._getExistingResolutionWorker(file);
        if (resolution && !(onMissing && resolution.result === "missing")) {
            return this._getFileResolution(resolution);
        }
    }

    private async _tryResolveUsingFileSystem(file: Uri): Promise<FileResolution | undefined> {
        if (!isFileSystemLocation(file)) return undefined;
        const content = await tryReadFileAsync(file);
        if (content !== undefined) {
            return this._recordOkResolution(file, localFileOk, content);
        }
    }

    private async _tryResolveUsingDirectoryRedirection(file: Uri): Promise<FileResolution | undefined> {
        if (!isFileSystemLocation(file)) return undefined;
        for (const dirname of walkUpContainingDirectories(file)) {
            const directory = this._directoryRedirections.get(dirname);
            if (directory) {
                const candidate = getCanonicalUri(resolveUri(ensureUriTrailingDirectorySeparator(directory.dirname), relativeUriFragment(dirname, file)));
                const content = await tryReadFileAsync(candidate);
                if (content !== undefined) {
                    return this._recordRedirectResolution(file, candidate, content, /*local*/ true);
                }
            }
        }
    }

    resetIgnoreMissing() {
        this._ignoreMissing = false;
    }

    private async _tryResolveUsingUiResolution(file: Uri, onMissing: UserFileResolver | "prompt" | undefined): Promise<FileResolution | undefined> {
        if (onMissing === "prompt") {
            const messageResult = this._ignoreMissing ?
                ignoreAllFileItem :
                await window.showErrorMessage(`File '${workspace.asRelativePath(file)}' could not be found.`, { modal: true }, pickLocationItem, ignoreFileItem, ignoreAllFileItem);

            if (!messageResult || messageResult === ignoreFileItem) {
                return this._recordSkipResolution(file, fileSkip);
            }

            if (messageResult === ignoreAllFileItem) {
                this._ignoreMissing = true;
                return this._recordSkipResolution(file, fileSkip);
            }

            const openResult = await window.showOpenDialog({
                canSelectFiles: true,
                defaultUri: file,
                filters: path.extname(file.path) === ".map" ?
                    { "Source Maps": ["map"] } :
                    { "Scripts": ["js", "jsx", "ts", "tsx"] }
            });

            if (!openResult?.length) {
                return this._recordSkipResolution(file, fileSkip);
            }

            const redirect = getCanonicalUri(openResult[0]);
            return this._recordRedirectResolution(file, redirect, await readFileAsync(redirect), /*local*/ true);
        }
    }

    private async _tryResolveUsingCustomResolution(file: Uri, onMissing: UserFileResolver | "prompt" | undefined): Promise<FileResolution | undefined> {
        if (typeof onMissing === "function") {
            const resolution = await onMissing(file);
            return resolution.result === "skip" ?
                this._recordSkipResolution(file, fileSkip) :
                this._recordRedirectResolution(file, resolution.file, await readFileAsync(resolution.file), /*local*/ false);
        }
    }

    private _getFileResolution(resolution: InternalFileResolution): FileResolution {
        return isSkipLike(resolution) ? fileSkip :
            isOkLike(resolution) ? resolution.local ? localFileOk : nonlocalFileOk :
            resolution;
    }

    private _recordResolution(file: Uri, resolution: InternalFileResolution) {
        this._resolutions.set(file, resolution);
        return this._getFileResolution(resolution);
    }

    private _recordSkipResolution(file: Uri, resolution: SkipFileResolution | MissingFileResolution) {
        this.delete(file);
        return this._recordResolution(file, resolution);
    }

    private _recordOkResolution(file: Uri, resolution: OkFileResolution | RedirectTargetFileResolution, content: string) {
        const existing = this._resolutions.get(file);
        if (existing && isOkLike(existing) && isOkLike(resolution) && !(existing.result === "ok" && resolution.result === "ok")) {
            const merged: RedirectTargetFileResolution = { result: "target", from: new StringSet(uriToString), local: existing.local && resolution.local };
            mergeResolution(merged, file, existing);
            mergeResolution(merged, file, resolution);
            this._resolvedSources.set(file, content);
            return this._recordResolution(file, merged);
        }
        this.delete(file);
        this._resolvedSources.set(file, content);
        return this._recordResolution(file, resolution);
    }

    private _recordRedirectResolution(file: Uri, redirect: Uri, content: string, local: boolean) {
        if (redirect === file) {
            return this._recordOkResolution(file, local ? localFileOk : nonlocalFileOk, content);
        }
        else {
            this._recordOkResolution(redirect, { result: "target", from: new StringSet(uriToString).add(file), local }, content);
            this.delete(file);
            const fileDirname = getCanonicalUri(resolveUri(file, "."));
            const redirectDirname = getCanonicalUri(resolveUri(redirect, "."));
            let directory = this._directoryRedirections.get(fileDirname);
            if (!directory) this._directoryRedirections.set(fileDirname, directory = { dirname: redirectDirname, originalFiles: new StringSet(uriToString) });
            directory.originalFiles.add(file);
            return this._recordResolution(file, { result: "redirect", file: redirect });
        }
    }

    delete(file: Uri) {
        const script = this._scriptUrlToScript.get(file);
        if (script !== undefined) {
            this._scriptIdToScript.delete(script.scriptId);
            this._scriptUrlToScript.delete(file);
            this._sourceMaps.delete(file);
            return true;
        }

        const resolution = this._resolutions.get(file);
        if (resolution !== undefined) {
            this._resolutions.delete(file);
            this._resolvedSources.delete(file);
            this._resolvedLineMaps.delete(file);
            this._sourceMaps.delete(file);
            if (resolution.result === "redirect") {
                // clean up outgoing directory redirections
                const fileDirname = getCanonicalUri(resolveUri(file, "."));
                const directory = this._directoryRedirections.get(fileDirname);
                if (directory?.originalFiles.delete(file) && directory.originalFiles.size === 0) {
                    this._directoryRedirections.delete(fileDirname);
                }

                // clean up incoming redirect references
                const target = this._resolutions.get(resolution.file);
                if (target?.result === "target" && target.from.delete(file)) {
                    if (target.from.size === 1 && target.from.has(resolution.file)) {
                        // The redirected file has been read explicitly, so switch the resolution to "ok"
                        this._resolutions.set(resolution.file, nonlocalFileOk);
                    }
                    else if (target.from.size === 0) {
                        // target is no longer referenced, so we can delete it.
                        this.delete(resolution.file);
                    }
                }
            }
            return true;
        }
        return false;
    }

    clear() {
        this._scriptUrlToScript.clear();
        this._resolutions.clear();
        this._resolvedSources.clear();
        this._resolvedLineMaps.clear();
        this._sourceMaps.clear();
        this._scriptIdToScript.clear();
        this._directoryRedirections.clear();
    }

    // #endregion Sources

    // #region Line Maps

    getExistingLineMap(file: Uri) {
        const script = this.getScript(file);
        if (script) {
            return script.lineMap;
        }

        const resolved = this._resolveFile(file);
        if (resolved !== undefined) {
            return this._getExistingLineMapWorker(resolved);
        }
    }

    private _getExistingLineMapWorker(resolved: Uri) {
        let lineMap = this._resolvedLineMaps.get(resolved);
        if (lineMap === undefined) {
            const content = this._resolvedSources.get(resolved);
            if (content !== undefined) {
                lineMap = new LineMap(content);
                this._resolvedLineMaps.set(resolved, lineMap);
            }
        }
        return lineMap;
    }

    async getLineMapAsync(file: Uri, onMissing?: UserFileResolver | "prompt") {
        let resolved = this._resolveFile(file);
        if (resolved === undefined) {
            if (!isFileSystemLocation(file)) {
                return undefined;
            }

            await this.resolveAsync(file, onMissing);
            resolved = this._resolveFile(file);
            if (resolved === undefined) {
                return undefined;
            }
        }

        return this._getExistingLineMapWorker(resolved);
    }

    // #endregion Line Maps

    // #region Source Maps

    getExistingSourceMap(file: Uri): SourceMap | "no-sourcemap" | undefined {
        const resolved = this._resolveFile(file);
        if (resolved !== undefined) {
            const sourceMap = this._getExistingSourceMapWorker(resolved);
            return sourceMap === "no-sourcemap" || sourceMap instanceof SourceMap ? sourceMap : undefined;
        }
    }

    /**
     * Gets an existing (or synchronously available) `SourceMap` for the provided path.
     * @returns A `SourceMap` if one was found, a `string` if a source map URL could be found, `null` if the entry should be treated as missing, or `undefined` if nothing could be determined.
     */
    private _getExistingSourceMapWorker(resolved: Uri): SourceMap | Uri | "no-sourcemap" | undefined {
        let sourceMap = this._sourceMaps.get(resolved);
        if (sourceMap === undefined) {
            const content = this._getExistingContentWorker(resolved);
            if (content === undefined) {
                // content is not yet available
                return undefined;
            }

            const url = extractSourceMappingURL(content, resolved);
            if (url === undefined) {
                // content is available and no source map could be discovered
                // mark the file as not having a source map
                this._sourceMaps.set(resolved, "no-sourcemap");
                return "no-sourcemap";
            }

            // If we are able to parse an inline source map, store the result
            const data = getInlineSourceMapData(url);
            if (data !== undefined) {
                try {
                    sourceMap = new SourceMap(resolved, data, resolved);
                }
                catch (e) {
                    this._sourceMaps.set(resolved, "no-sourcemap");
                    throw e;
                }
                this._sourceMaps.set(resolved, sourceMap);
                return sourceMap;
            }

            this._sourceMaps.set(resolved, url);
            return url;
        }

        return sourceMap;
    }

    async getSourceMapAsync(file: Uri, onMissing?: UserFileResolver | "prompt"): Promise<SourceMap | "no-sourcemap"> {
        let resolved = this._resolveFile(file);
        if (resolved === undefined) {
            if (!isFileSystemLocation(file)) {
                return "no-sourcemap";
            }

            await this.resolveAsync(file, onMissing);
            resolved = this._resolveFile(file);
            if (resolved === undefined) {
                return "no-sourcemap";
            }
        }

        let sourceMap = this._getExistingSourceMapWorker(resolved);
        if (sourceMap === "no-sourcemap") {
            return "no-sourcemap";
        }

        if (sourceMap instanceof Uri) {
            const data = isFileSystemLocation(sourceMap) ? await tryReadFileAsync(sourceMap) : undefined;
            if (data !== undefined) {
                try {
                    sourceMap = new SourceMap(resolved, data, sourceMap);
                }
                catch (e) {
                    this._sourceMaps.set(resolved, "no-sourcemap");
                    throw e;
                }
            }
            else {
                sourceMap = "no-sourcemap";
            }
        }

        if (sourceMap === undefined) {
            sourceMap = "no-sourcemap";
        }

        this._sourceMaps.set(resolved, sourceMap);
        return sourceMap;
    }

    // #endregion Source Maps

    // #region SourceFile

    getExistingSourceFile(file: Uri) {
        const sourceFile = this._resolvedSourceFiles.get(file);
        if (sourceFile) {
            return sourceFile;
        }

        const resolved = this._resolveFile(file);
        if (resolved !== undefined) {
            return this._getExistingSourceFileWorker(resolved);
        }
    }

    private _getExistingSourceFileWorker(resolved: Uri) {
        const extname = uriExtname(resolved);
        switch (extname) {
            case ".js":
            case ".jsx":
            case ".ts":
            case ".tsx":
                break;
            default:
                return undefined;
        }
        let sourceFile = this._resolvedSourceFiles.get(resolved);
        if (sourceFile === undefined) {
            const content = this._getExistingContentWorker(resolved);
            if (content !== undefined) {
                sourceFile = ts.createSourceFile(resolved.scheme === "file" ? fileUriToPath(resolved) : resolved.toString(), content, ts.ScriptTarget.ESNext, /*setParentNodes*/ true);
                this._resolvedSourceFiles.set(resolved, sourceFile);
            }
        }
        return sourceFile;
    }

    async getSourceFileAsync(file: Uri, onMissing?: UserFileResolver | "prompt") {
        let resolved = this._resolveFile(file);
        if (resolved === undefined) {
            if (!isFileSystemLocation(file)) {
                return undefined;
            }

            await this.resolveAsync(file, onMissing);
            resolved = this._resolveFile(file);
            if (resolved === undefined) {
                return undefined;
            }
        }

        return this._getExistingSourceFileWorker(resolved);
    }

    // #endregion SourceFile

    * scripts(): IterableIterator<Script> {
        yield* this._scriptIdToScript.values();
    }

    * resolvedFiles(): IterableIterator<Uri> {
        const seen = new StringSet(uriToString);
        for (const key of this._scriptUrlToScript.keys()) {
            if (!seen.has(key)) {
                seen.add(key);
                yield key;
            }
        }
        for (const key of this._resolvedSources.keys()) {
            if (!seen.has(key)) {
                seen.add(key);
                yield key;
            }
        }
    }

    * failedFiles(): IterableIterator<Uri> {
        for (const [key, resolution] of this._resolutions.entries()) {
            if (isSkipLike(resolution)) {
                yield key;
            }
        }
    }
}

function isOkLike(resolution: InternalFileResolution): resolution is OkFileResolution | RedirectTargetFileResolution {
    return resolution.result === "ok" || resolution.result === "target";
}

function isSkipLike(resolution: InternalFileResolution): resolution is SkipFileResolution | MissingFileResolution {
    return resolution.result === "skip" || resolution.result === "missing";
}

function mergeResolution(target: RedirectTargetFileResolution, file: Uri, other: OkFileResolution | RedirectTargetFileResolution) {
    if (other.result === "ok") {
        target.from.add(file);
    }
    else {
        for (const file of other.from) {
            target.from.add(file);
        }
    }
}

function uriToString(x: Uri) {
    return x.toString();
}