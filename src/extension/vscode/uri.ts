// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Uri } from "vscode";
import { isDosPath, normalizePathPosix, normalizePathWindows } from "../../core/paths";
import { isUriString, resolveUri } from "../../core/uri";
import { CanonicalPath, CanonicalUri, CanonicalUriString, getCanonicalPath, getCanonicalUri } from "../services/canonicalPaths";

export const UNKNOWN_URI = Uri.parse("unknown:");

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
    return Uri.file(normalizePathPosix(canonicalize ? getCanonicalPath(file) : file));
}

const fsAbsolutePathStartRegExp = /^(?:[\\/]|[a-z]:)/i;

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
    if (uri.scheme === "file") return canonicalize ? getCanonicalPath(uri.fsPath) : normalizePathPosix(uri.fsPath);
    return (canonicalize ? resolveUri(uri) : uri).toString();
}

export interface FormatUriOptions {
    as?: "uri" | "file";
    skipEncoding?: boolean;
}

export function formatUri(uri: CanonicalUri, options?: { as?: "uri", skipEncoding?: false }): CanonicalUriString;
export function formatUri(uri: Uri | undefined, options?: FormatUriOptions): string;
export function formatUri(uri: Uri | undefined, { as = "uri", skipEncoding }: FormatUriOptions = {}) {
    return uri ? as === "uri" || uri.scheme !== "file" ? uri.toString(skipEncoding) : fileUriToPath(uri) : "";
}
