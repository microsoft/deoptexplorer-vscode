// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Comparer, Equaler } from "@esfx/equatable";
import { CanonicalUriString } from "#extension/services/canonicalPaths.js";
import * as path from "path";
import { Uri } from "vscode";
import { assert } from "./assert";
import { ensureTrailingDirectorySeparator } from "./paths";
import { RegisteredSerializer, registerKnownSerializer } from "./serializer";

/**
 * Ensures a {@link Uri} path ends with a trailing `/`
 */
export function ensureUriTrailingDirectorySeparator(uri: Uri): Uri {
    const path = ensureTrailingDirectorySeparator(uri.path);
    return uri.path === path ? uri : uri.with({ path, query: "", fragment: "" });
}

const isWindows = process.platform === "win32";
const uriPathStartRegExp = /^(?:[\\/](?:[a-z](?:[:|]|%3a|%7c)[\\/]?)?|[a-z](?:[:|]|%3a|%7c)[\\/]?)/i;
const uriSlashesRegExp = /[\\/]/g;
const uriPartDosRootRegExp = /^[a-z](?:[:|]|%3a|%7c)$/i;
const uriPartSingleDotRegExp = /^(?:\.|%2e)$/i;
const uriPartDoubleDotRegExp = /^(?:\.|%2e){2}$/i;
const uriNonNormalizedSegmentRegExp = /(?:^|[\\/])(?:\.|%2e){1,2}(?:$|[\\/])|\\/i;
const uriNormalizedRootRegExp = /^\/(?![a-z](?:[:|]|%3[aA]|%7[cC])|[A-Z](?:[|]|%3[aA]|%7[cC]))(?:[A-Z]:\/)?/;

type PathParts = [root: string, ...rest: string[]];

const EMPTY_PATH: PathParts = [""];
const POSIX_ROOT_PATH: PathParts = ["/"];
const EMPTY_URI = Uri.parse("unused:", /*strict*/ true);
const BACKSLASH = "\\".charCodeAt(0);
const SLASH = "/".charCodeAt(0);
const COLON = ":".charCodeAt(0);

export function splitUriPath(path: string): PathParts {
    if (path === "") return EMPTY_PATH;
    if (path === "/" || path === "\\") return POSIX_ROOT_PATH;

    // If path is not missing, it must start with a path separator or a DOS drive root.
    let root = uriPathStartRegExp.exec(path)?.[0];
    if (!root) {
        throw new SyntaxError("Expected path to start with '/', '\\', or a DOS drive letter (i.e., 'C:')");
    }

    // If the first segment is a DOS drive root, clean up the path and make it the root
    const rootLength = root.length;
    if (rootLength > 1) {
        const ch = root.charCodeAt(0);
        const driveLetter = root.charCodeAt(ch === SLASH || ch === BACKSLASH ? 1 : 0);
        root = String.fromCharCode(SLASH, driveLetter & ~0b100000, COLON, SLASH);
    }

    // Split on any unencoded slash ('\' or '/')
    if (rootLength === path.length) return [root];
    return [root, ...path.slice(rootLength).split(uriSlashesRegExp)];
}

function joinPathParts(path: PathParts) {
    if (path === EMPTY_PATH) return "";
    if (path === POSIX_ROOT_PATH) return "/";
    const [root, ...parts] = path;
    return root + parts.join("/");
}

function reducePathParts(path: PathParts): PathParts {
    // Path can be missing (i.e. `http://foo.com`)
    if (path === EMPTY_PATH) return path;

    // Shortcut for `/`
    if (path === POSIX_ROOT_PATH) return path;

    const root = path[0];

    let part: string | undefined; // Keep track of the last part to ensure a trailing '/' if necessary (see below).
    let resolvedPath: string[] | undefined;
    let lastPartWasDotOrDotDot = false;
    for (let i = 1; i < path.length; i++) {
        part = path[i];
        if (uriPartDoubleDotRegExp.test(part)) { // for '..', shorten the path
            lastPartWasDotOrDotDot = true;
            resolvedPath ??= path.slice(1, i);
            resolvedPath.pop();
            continue;
        }

        if (uriPartSingleDotRegExp.test(part)) { // for '.', skip the part
            lastPartWasDotOrDotDot = true;
            resolvedPath ??= path.slice(1, i);
            continue;
        }

        // append the segment
        lastPartWasDotOrDotDot = false;
        resolvedPath?.push(part);
    }

    // if the last segment was '.' or '..', append an empty segment so that we preserve a trailing '/'
    if (lastPartWasDotOrDotDot) {
        // resolved must be defined if we encountered a `.` or `..`.
        assert(resolvedPath);
        resolvedPath.push("");
    }

    if (resolvedPath !== undefined) {
        // `resolved` will be `undefined` if no changes were made.
        return [root, ...resolvedPath];
    }

    // if no changes were made, return the original path
    return path;
}

function isReducedPathFast(path: string) {
    if (path === "" || path === "/") return true;
    const root = uriPathStartRegExp.exec(path)?.[0];
    if (!root) return true;
    if (!root.startsWith("/")) return false;
    if (root.length > 1) {
        if (root.length !== 4 ||
            root.charCodeAt(0) !== SLASH ||
            root.charCodeAt(1) & 0b100000 ||
            root.charCodeAt(2) !== COLON ||
            root.charCodeAt(3) !== SLASH) {
            return false;
        }
    }
    return !uriNonNormalizedSegmentRegExp.test(path);
}

export function reducePath(path: string): string {
    return isReducedPathFast(path) ? path : joinPathParts(reducePathParts(splitUriPath(path)));
}

/**
 * Resolve a {@link Uri} by combining it with one or more parts.
 * @param base The base {@link Uri} from which to start resolution.
 * @param parts Zero or more `string` or {@link Uri} segments to resolve relative to the {@link base}.
 * @returns The resolved {@link Uri}.
 */
export function resolveUri(base: Uri, ...parts: (string | Uri)[]) {
    let { authority, path, query, fragment } = base;
    path = reducePath(path);
    for (let part of parts) {
        if (typeof part === "string" && isUriString(part)) { // parse qualified URI strings into `Uri` objects.
            part = Uri.parse(part, /*strict*/ true);
        }

        if (part instanceof Uri) { // if the part is a `Uri`, it replaces the base.
            base = part;
            ({ authority, path, query, fragment } = base);
            path = reducePath(path);
            continue;
        }

        // parse the part as a `Uri` with a dummy scheme
        const { authority: uriAuthority, path: uriPath, query: uriQuery, fragment: uriFragment } = Uri.parse(`scheme:${part}`, /*strict*/ true);
        if (part.startsWith("//")) {
            // If the part contains an authority, overwrite the authority, path, query, and fragment
            authority = uriAuthority;
            path = reducePath(uriPath);
            query = uriQuery;
            fragment = uriFragment;
        }
        else if (uriPath !== "") {
            // If the part contains a path, resolve the path and overwrite the query and fragment.
            if (!(path.startsWith("/") || path.startsWith("\\")) || uriPath.startsWith("/") || uriPath.startsWith("\\")) {
                // If the base path is not absolute or the part's path *is* absolute, overwrite the path.
                path = reducePath(uriPath);
            }
            else {
                // Otherwise, combine and reduce the paths.
                let lastSlashIndex = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
                path = reducePath(path.slice(0, lastSlashIndex + 1) + uriPath);
            }
            query = uriQuery;
            fragment = uriFragment;
        }
        else if (uriQuery !== "") {
            // If the part contains a query, overwrite the query and fragment.
            query = uriQuery;
            fragment = uriFragment;
        }
        else if (uriFragment !== "") {
            // If the part contains a fragment, overwrite the fragment.
            fragment = uriFragment;
        }
    }
    return base.with({ authority, path, query, fragment });
}

function formatUriFragment(from: "authority" | "path" | "query" | "fragment", authority: string, path: string, query: string, fragment: string) {
    if (from === "fragment" && !fragment) from = "query";
    if (from === "query" && !query) from = "path";
    let base = "dummy:";
    if (from !== "authority") {
        if (from !== "path" || path.startsWith("/") || path.startsWith("\\")) {
            authority = "dummy";
            base += "//dummy";
        }
        else {
            authority = "";
        }
        if (from !== "path") {
            path = "/";
            base += "/";
            if (from !== "query") {
                query = "";
            }
        }
    }
    return Uri.parse(base, /*strict*/ true).with({ authority, path, query, fragment }).toString().slice(base.length);
}

function relativePathParts(from: PathParts, to: PathParts): PathParts {
    let start: number;
    for (start = 0; start < from.length && start < to.length; start++) {
        const fromPart = from[start];
        const toPart = to[start];
        if (fromPart !== toPart) break;
    }

    if (start === 0) {
        // entire path is different
        return to;
    }

    // we cannot walk back more steps than the root
    const components = to.slice(start);
    const maxSteps = from.length - start - 1;
    const relative: string[] = [];
    for (; start < from.length && relative.length < maxSteps; start++) {
        relative.push("..");
    }
    return ["", ...relative, ...components];
}

/**
 * Gets a relative URI fragment between two {@link Uri} objects.
 */
export function relativeUriFragment(from: Uri, to: Uri) {
    // normalize both arguments
    from = resolveUri(from);
    to = resolveUri(to);
    if (to.scheme !== from.scheme) {
        // if the scheme doesn't match then the fragment must be absolute.
        return to.toString();
    }
    if (to.authority !== from.authority) {
        return formatUriFragment("authority", to.authority, to.path, to.query, to.fragment);
    }
    if (to.path !== from.path) {
        if (!to.path.startsWith("/") || !from.path.startsWith("/")) {
            // if either argument is not rooted, we cannot compute a relative path
            return to.toString();
        }

        // if the path does not match, we must compute a relative path
        const relative = relativePathParts(splitUriPath(from.path), splitUriPath(to.path));
        return formatUriFragment("path", "", joinPathParts(relative), to.query, to.fragment);
    }
    if (to.query !== from.query) {
        return formatUriFragment("query", "", to.path, to.query, to.fragment);
    }
    if (to.fragment !== from.fragment) {
        return formatUriFragment("fragment", "", to.path, to.query, to.fragment);
    }
    return "";
}

export function uriBasename(uri: Uri, ext?: string) {
    return path.posix.basename(uri.path, ext);
}

export function uriExtname(uri: Uri) {
    return path.posix.extname(uri.path);
}

const fsAbsolutePathStartRegExp = /^(?:[\\/]|[a-z]:)/i;
const uriStartRegExp = /^[a-z][-+.a-z0-9]*:/i;

/**
 * Tests whether an input string is a valid URI string
 */
export function isUriString(text: CanonicalUriString): text is CanonicalUriString;
export function isUriString(text: string): boolean;
export function isUriString(text: string) {
    // an empty string is not a valid uri
    if (text === "") return false;
    // a POSIX or DOS drive root is not a valid URI
    if (fsAbsolutePathStartRegExp.test(text)) return false;
    // a string that does not start with a protocol (i.e., `scheme:`) is not a valid URI
    if (!uriStartRegExp.test(text)) return false;
    // if we fail to parse the URL, then its not a valid URI
    try { new URL(text); } catch { return false; }
    return true;
}

export function computeCommonBaseDirectory(files: Iterable<Uri>) {
    let scheme: string | undefined;
    let authority: string | undefined;
    let pathParts: PathParts | undefined;
    next: for (let file of files) {
        if (scheme === undefined) {
            scheme = file.scheme;
        }
        else if (scheme !== file.scheme) {
            return undefined;
        }

        if (authority === undefined) {
            authority = file.authority;
        }
        else if (authority !== file.authority) {
            return undefined;
        }

        if (!uriPathStartRegExp.test(file.path)) {
            return undefined;
        }

        let parts = splitUriPath(file.path);
        if (!isReducedPathFast(file.path)) {
            parts = reducePathParts(parts);
        }

        // remove file basename
        if (parts.length > 1) {
            parts.pop();
        }

        if (pathParts === undefined) {
            pathParts = parts;
            continue;
        }

        const commonLength = Math.min(pathParts.length, parts.length);
        for (let i = 0; i < commonLength; i++) {
            if (decodeURIComponent(parts[i]) !== decodeURIComponent(pathParts[i])) {
                if (i === 0) {
                    return undefined;
                }
                pathParts.length = i;
                continue next;
            }
        }

        if (parts.length < pathParts.length) {
            pathParts.length = parts.length;
        }
    }

    if (scheme === undefined || authority === undefined || pathParts === undefined) {
        return undefined;
    }

    const path = joinPathParts(pathParts);
    const base = EMPTY_URI.with({ scheme, authority, path: path.endsWith("/") ? path : path + "/" });
    return base;
}

export const UriEqualer = Equaler.create<Uri | null | undefined>(
    (x, y) => x === y || x?.toString() === y?.toString(),
    (x) => Equaler.defaultEqualer.hash(x?.toString())
);

export const UriComparer = Comparer.create<Uri | null | undefined>(
    (x, y) => x === y ? 0 : Comparer.defaultComparer.compare(x?.toString(), y?.toString())
);

declare global {
    interface KnownSerializers {
        Uri: RegisteredSerializer<Uri, { $mid: 1, fsPath: string, external: string, _sep: 1 | undefined }>;
    }
}

export const UriSerializer = registerKnownSerializer("Uri", {
    canSerialize: obj => obj instanceof Uri,
    canDeserialize: obj => obj.$mid === 1,
    serialize: obj => obj.toJSON(),
    deserialize: obj => (Uri as any).revive(obj),
    builtin: true
});

export function isJsxFile(uri: Uri) {
    const extname = uriExtname(uri);
    switch (extname) {
        case ".jsx":
        case ".cjsx":
        case ".mjsx":
            return true;
    }
    return false;
}

export function isJavaScriptFile(uri: Uri, excludeJsx = false) {
    const extname = uriExtname(uri);
    switch (extname) {
        case ".js":
        case ".cjs":
        case ".mjs":
            return true;
        case ".jsx":
        case ".cjsx":
        case ".mjsx":
            return !excludeJsx;
    }
    return false;
}

export function isTsxFile(uri: Uri) {
    const extname = uriExtname(uri);
    switch (extname) {
        case ".tsx":
            return true;
    }
    return false;
}

export function isTypeScriptFile(uri: Uri, excludeTsx = false) {
    const extname = uriExtname(uri);
    switch (extname) {
        case ".ts":
            return true;
        case ".tsx":
            return !excludeTsx;
    }
    return false;
}

