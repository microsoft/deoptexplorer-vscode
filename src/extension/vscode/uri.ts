// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { markdown } from "#core/markdown.js";
import { isDosPath, normalizePathPosix, normalizePathWindows } from "#core/paths.js";
import { Sources } from "#core/sources.js";
import { isUriString, relativeUriFragment, resolveUri } from "#core/uri.js";
import { Uri } from "vscode";
import * as constants from "../constants";
import { getScriptSourceUri } from "../fileSystemProviders/scriptSourceFileSystemProvider";
import { LogFile } from "../model/logFile";
import { CanonicalPath, CanonicalUri, CanonicalUriString, getCanonicalUri } from "../services/canonicalPaths";

export const UNKNOWN_URI = Uri.parse(`${constants.schemes.unknown}:`);

const isWindows = process.platform === "win32";

/**
 * Convert a canonical `file://` URI to a canonical file-system path.
 */
export function fileUriToPath(uri: CanonicalUri): CanonicalPath;
/**
 * Convert a `file://` URI to a file-system path.
 * @param canonicalize Indicates whether the input value should be converted to a canonical path.
 */
export function fileUriToPath(uri: Uri | string, canonicalize: true): CanonicalPath;
/**
 * Convert a `file://` URI to a file-system path.
 * @param canonicalize Indicates whether the input value should be converted to a canonical path.
 */
export function fileUriToPath(uri: Uri | string, canonicalize?: boolean): string;
export function fileUriToPath(uri: Uri | string, canonicalize?: boolean) {
    if (typeof uri === "string") uri = Uri.parse(uri, /*strict*/ true);
    if (uri.scheme !== "file") throw new TypeError("Uri is not a file: uri");
    if (canonicalize) uri = getCanonicalUri(uri);
    return !canonicalize && isWindows && isDosPath(uri.fsPath) ?
        normalizePathWindows(uri.fsPath) :
        normalizePathPosix(uri.fsPath);
}

/**
 * Converts a canonical file-system path to a canonical `file://` URI.
 */
export function pathToFileUri(file: CanonicalPath): CanonicalUri;
/**
 * Converts a file-system path to a `file://` URI.
 * @param canonicalize Indicates whether the input value should be converted to a canonical `file://` URI.
 */
export function pathToFileUri(file: string, canonicalize: true): CanonicalUri;
/**
 * Converts a file-system path to a `file://` URI.
 * @param canonicalize Indicates whether the input value should be converted to a canonical `file://` URI.
 */
export function pathToFileUri(file: string, canonicalize?: boolean): Uri;
export function pathToFileUri(file: string, canonicalize?: boolean) {
    const uri = Uri.file(normalizePathPosix(file));
    return canonicalize ? getCanonicalUri(uri) : uri;
}

const fsAbsolutePathStartRegExp = /^(?:[\\/]|[a-z]:)/i;

export function isPathOrUriString(text: string) {
    return isUriString(text) || fsAbsolutePathStartRegExp.test(text);
}

/**
 * Converts a canonical file-system path or a canonical URI string into a canonical URI.
 */
export function pathOrUriStringToUri(text: CanonicalPath | CanonicalUriString): CanonicalUri;
/**
 * Converts a file-system path or URI string into a URI.
 * @param canonicalize Indicates whether the input value should be converted to a canonical URI.
 */
export function pathOrUriStringToUri(text: string, canonicalize: true): CanonicalUri;
/**
 * Converts a file-system path or URI string into a URI.
 * @param canonicalize Indicates whether the input value should be converted to a canonical URI.
 */
export function pathOrUriStringToUri(text: string, canonicalize?: boolean): Uri;
export function pathOrUriStringToUri(text: string, canonicalize?: boolean) {
    if (isUriString(text)) return canonicalize ? getCanonicalUri(Uri.parse(text, /*strict*/ true)) : Uri.parse(text, /*strict*/ true);
    if (fsAbsolutePathStartRegExp.test(text)) return canonicalize ? getCanonicalUri(Uri.file(text)) : Uri.file(text);
    throw new TypeError(`Expected argument to be an absolute path or URI: '${text}'`);
}

export function uriToPathOrUriString(uri: CanonicalUri): CanonicalPath | CanonicalUriString;
export function uriToPathOrUriString(uri: Uri, canonicalize: true): CanonicalPath | CanonicalUriString;
export function uriToPathOrUriString(uri: Uri, canonicalize?: boolean): string;
export function uriToPathOrUriString(uri: Uri, canonicalize?: boolean) {
    if (uri.scheme === "file") return normalizePathPosix((canonicalize ? getCanonicalUri(uri) : uri).fsPath);
    return (canonicalize ? resolveUri(uri) : uri).toString();
}

export interface FormatUriOptions {
    as?: "uri" | "file";
    skipEncoding?: boolean;
    relativeTo?: Uri | { log: LogFile, ignoreIfBasename?: boolean };
}

export function formatUri(uri: CanonicalUri, options?: { as?: "uri", skipEncoding?: false }): CanonicalUriString;
export function formatUri(uri: Uri | undefined, options?: FormatUriOptions): string;
export function formatUri(uri: Uri | undefined, { as = "uri", skipEncoding, relativeTo }: FormatUriOptions = {}) {
    if (!uri) {
        return "";
    }

    const asFile = as === "file" && uri.scheme === "file";
    if (relativeTo instanceof Uri) {
        const fragment = relativeUriFragment(relativeTo, uri);
        return asFile && isWindows ? fragment.replaceAll("/", "\\") : fragment;
    }

    if (relativeTo?.log) {
        const fragment = relativeTo.log.tryGetRelativeUriFragment(uri, { ignoreIfBasename: relativeTo.ignoreIfBasename });
        if (fragment) {
            return asFile && isWindows ? fragment.replaceAll("/", "\\") : fragment;
        }
    }

    return asFile ? fileUriToPath(uri) : uri.toString(skipEncoding);
}

export interface FormatUriMarkdownOptions extends FormatUriOptions {
    trusted?: boolean;
    label?: string;
    title?: string;
    schemes?: { allow?: string[], deny?: string[] };
    linkSources?: Sources;
}

const defaultSchemes = { deny: ["node"] };

export function formatUriMarkdown(uri: Uri | undefined, { as = "uri", skipEncoding, trusted = false, label, title, schemes = defaultSchemes, relativeTo, linkSources }: FormatUriMarkdownOptions = {}) {
    const md = trusted ? markdown.trusted : markdown;
    if (!uri) {
        return md``;
    }

    label ??= formatUri(uri, { as, skipEncoding, relativeTo });
    if (schemes.deny?.includes(uri.scheme) || schemes.allow && !schemes.allow.includes(uri.scheme)) {
        return md`${label}`;
    }
    
    const linkUri = linkSources ? getScriptSourceUri(uri, linkSources) : uri;
    if (!linkUri) {
        return md`${label}`;
    }

    const link = formatUri(linkUri, { as: "uri" });
    title ??= formatUri(uri, { as: "file", skipEncoding: true });
    return md`[${label}](${link}${title ? md` "${title}"`: ""})`;
}
