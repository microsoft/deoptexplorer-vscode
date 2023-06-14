// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from "path";
import { fileURLToPath, URL } from "url";
import { Uri } from "vscode";
import { isUriString } from "./uri";

export function isFileSystemLocation(file: string | Uri | URL) {
    if (file instanceof Uri) return file.scheme === "file" || file.scheme === "vscode-remote";
    if (file instanceof URL) return file.protocol === "file:" || file.protocol === "vscode-remote:";
    if (typeof file !== "string") return false;
    if (isUriString(file)) return file.startsWith("file://") || file.startsWith("vscode-remote://");
    return path.isAbsolute(file);
}

const backslashRegExp = /\\/g;

export function normalizeSlashesPosix(file: string) {
    return file.replace(backslashRegExp, "/");
}

const forwardslashRegExp = /\\/g;

export function normalizeSlashesWindows(file: string) {
    return file.replace(forwardslashRegExp, "\\");
}

const lowerDosPathRegExp = /^([a-z]):/g;

export function normalizeDosPathRoot(file: string) {
    return file.replace(lowerDosPathRegExp, (_, drive: string) => `${drive.toUpperCase()}:`);
}

export function normalizePathPosix(file: string) {
    return normalizeDosPathRoot(normalizeSlashesPosix(file));
}

export function normalizePathWindows(file: string) {
    return normalizeDosPathRoot(normalizeSlashesWindows(file));
}

const dosPathRegExp = /^([a-z]):/i;

export function isDosPath(file: string) {
    return dosPathRegExp.test(file);
}

export function toFileSystemPath(file: string | Uri): string {
    if (file instanceof Uri) {
        if (file.scheme !== "file") throw new Error(`Expected scheme 'file', received '${file.scheme}' instead.`);
        file = file.fsPath;
    }
    else if (isUriString(file)) {
        const url = new URL(file);
        if (url.protocol === "file:") file = fileURLToPath(file);
    }
    return isDosPath(file) ? normalizeDosPathRoot(normalizeSlashesWindows(file)) : normalizeSlashesPosix(file);
}

const relativePathRegExp = /^\.\.?($|[\\/])/;

export function ensureRelativePathIsDotted(file: string) {
    if (isUriString(file)) return file;
    if (path.isAbsolute(file)) return file;
    if (relativePathRegExp.test(file)) return file;
    if (file === "") return ".";
    return `./${file}`;
}

/**
 * Ensures a path ends with a trailing `/`
 */
export function ensureTrailingDirectorySeparator(file: string): string {
    return file.endsWith("/") ? file : file + "/";
}
