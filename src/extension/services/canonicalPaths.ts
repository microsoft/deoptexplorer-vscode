// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath, URL } from "url";
import { Disposable, ExtensionContext, Location, Uri } from "vscode";
import { isDosPath, isFileSystemLocation, normalizeDosPathRoot, normalizePathPosix, normalizeSlashesPosix, normalizeSlashesWindows } from "../../core/paths";
import { isUriString, resolveUri } from "../../core/uri";
import { formatUri } from "../vscode/uri";

const validExtensionRegExp = /\.(jsx?|tsx?)$/i;
const backslashRegExp = /\\/g;
const forwardslashRegExp = /\\/g;
const lowerDosPathRegExp = /^([a-z]):/g;
const dosPathRegExp = /^([a-z]):/i;
const uriProtocolRegExp = /^[a-z][-a-z0-9+.]*:/i;

/**
 * Tests whether a file is one we ignore
 */
export function isIgnoredFile(file: string | Uri | undefined) {
    if (file instanceof Uri) file = formatUri(file, { as: "file" });
    if (typeof file !== "string") return true;
    if (!path.isAbsolute(file)) return true;
    if (!validExtensionRegExp.test(file)) return true;
    return false;
}

declare const canonicalPath: unique symbol;
declare const canonicalUri: unique symbol;
declare const canonicalUriString: unique symbol;

/** @deprecated */
export type CanonicalPath = string & { [canonicalPath]: never };
export type CanonicalUri = Uri & { [canonicalUri]: never, fsPath: CanonicalPath, toString(): CanonicalUriString };
export type CanonicalUriString = string & { [canonicalUriString]: never };
export type CanonicalLocation = Location & { readonly uri: CanonicalUri };

const canonicalPathCache = new Map<string, CanonicalPath>();

/**
 * Gets the canonical file system path for the provided file.
 * @param file A string or `file:` URI.
 * @returns A string representing the canonical form of the provided path.
 * @deprecated Use {@link getCanonicalUri} instead.
 */
export function getCanonicalPath(file: string): CanonicalPath {
    let canonicalPath = canonicalPathCache.get(file);
    if (canonicalPath !== undefined) {
        return canonicalPath;
    }

    const originalFileString = file;
    if (isUriString(file)) {
        const url = new URL(file);
        if (url.protocol === "file:") {
            file = fileURLToPath(file);
        }
    }

    if (isIgnoredFile(file)) {
        canonicalPath = normalizePathPosix(file) as CanonicalPath;
    }
    else if (fs.realpathSync.native) {
        // Use `realpathSync.native`, if available, to get the correct casing.
        canonicalPath = normalizePathPosix(fs.realpathSync.native(file)) as CanonicalPath;
    }
    else {
        // Fall back to `realpathSync`, and only correct the casing of the root path
        canonicalPath = normalizePathPosix(fs.realpathSync(file)) as CanonicalPath;
    }

    canonicalPathCache.set(file, canonicalPath);
    if (originalFileString !== file) {
        canonicalPathCache.set(originalFileString, canonicalPath);
    }

    return canonicalPath;
}

/**
 * Gets a canonical URI from the provided URI and optional base.
 *
 * NOTE: Uses URL resolution semantics, so `getCanonicalUri(".", "file:///C%3A/foo/bar")`
 * returns a `Uri` for `"file:///C%3A/foo/"`, unlike `Uri.joinPath` which works more like
 * Node.js's `path.join`.
 *
 * - `getCanonicalUri(".", "file:///C%3A/foo/bar")` → `"file:///C%3A/foo/"`
 * - `getCanonicalUri("./", "file:///C%3A/foo/bar")` → `"file:///C%3A/foo/"`
 * - `getCanonicalUri("..", "file:///C%3A/foo/bar")` → `"file:///C%3A/"`
 * - `getCanonicalUri("../", "file:///C%3A/foo/bar")` → `"file:///C%3A/"`
 */
export function getCanonicalUri(uri: Uri) {
    if (uri.scheme === "file") {
        const fsPath = getCanonicalPath(uri.fsPath);
        return (fsPath !== normalizePathPosix(uri.fsPath) ? Uri.file(fsPath) : uri) as CanonicalUri;
    }
    return resolveUri(uri) as CanonicalUri;
}

export function getCanonicalLocation(location: Location) {
    const uri = getCanonicalUri(location.uri);
    return (uri === location.uri ? location : new Location(uri, location.range)) as CanonicalLocation;
}

export function* walkUpContainingDirectories(file: Uri) {
    if (!isFileSystemLocation(file)) return;

    let directory = resolveUri(file, ".");
    while (true) {
        yield getCanonicalUri(directory);

        if (directory.path === "/" || directory.path === "") break;

        const parent = resolveUri(directory, "../");
        if (directory.path === parent.path) break;
        directory = parent;
    }
}

export function activateCanonicalPaths(context: ExtensionContext) {
    return new Disposable(() => {
        canonicalPathCache.clear();
    });
}
