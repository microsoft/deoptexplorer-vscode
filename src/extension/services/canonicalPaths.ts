// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { isFileSystemLocation, normalizePathPosix } from "#core/paths.js";
import { reducePath, resolveUri } from "#core/uri.js";
import * as fs from "fs";
import { ExtensionContext, Location, Uri } from "vscode";
import { VSDisposableStack } from "../vscode/disposable";

declare const canonicalPath: unique symbol;
declare const canonicalUri: unique symbol;
declare const canonicalUriString: unique symbol;

/** @deprecated */
export type CanonicalPath = string & { [canonicalPath]: never };
export type CanonicalUri = Uri & { [canonicalUri]: never, fsPath: CanonicalPath, toString(): CanonicalUriString };
export type CanonicalUriString = string & { [canonicalUriString]: never };
export type CanonicalLocation = Location & { readonly uri: CanonicalUri };

let canonicalPathCache: Map<string, CanonicalPath> | undefined;

function tryRealpath(file: string) {
    try {
        // Use `realpathSync.native`, if available, to get the correct casing.
        if (fs.realpathSync.native) {
            return fs.realpathSync.native(file);
        }

        // Fall back to `realpathSync`
        return fs.realpathSync(file); 

    }
    catch {
        return undefined;
    }
}

/**
 * Gets the canonical file system path for the provided file.
 * @param file A string.
 * @returns A string representing the canonical form of the provided path.
 */
function getCanonicalPath(file: string): CanonicalPath {
    let canonicalPath = canonicalPathCache?.get(file);
    if (canonicalPath !== undefined) {
        return canonicalPath;
    }

    const realPath = tryRealpath(file) ?? file;
    const reducedPath = reducePath(realPath);
    canonicalPath = normalizePathPosix(reducedPath) as CanonicalPath;
    canonicalPathCache?.set(file, canonicalPath);
    return canonicalPath;
}

/**
 * Gets a canonical URI from the provided URI.
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
    canonicalPathCache = new Map();
    const stack = new VSDisposableStack();
    stack.defer(() => { canonicalPathCache = undefined!; });
    return stack;
}
