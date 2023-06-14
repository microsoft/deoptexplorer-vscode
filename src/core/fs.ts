// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from "fs";
import { URL } from "url";
import { TextDecoder } from "util";
import { FileStat, FileType, Uri, workspace } from "vscode";
import { assert } from "./assert";
import { isUriString } from "./uri";

// /**
//  * Attempts a synchronous stat(2) to get file status.
//  * @param file Path to a file. If a `URL` or `Uri` is provided, it must use the `file:` protocol.
//  */
// export function tryStatSync(file: string | URL | Uri): FileStat | undefined {
//     try {
//         if (file instanceof Uri) {
//             if (file.scheme !== "file") return;
//             file = file.fsPath;
//         }
//         const stat = fs.statSync(file);
//         let type = FileType.Unknown;
//         if (stat.isDirectory()) type |= FileType.Directory;
//         if (stat.isFile() || stat.isCharacterDevice()) type |= FileType.File;
//         if (stat.isSymbolicLink()) type |= FileType.SymbolicLink;
//         return {
//             ctime: stat.ctimeMs,
//             mtime: stat.mtimeMs,
//             size: stat.size,
//             type
//         }
//     }
//     catch {
//         return undefined;
//     }
// }

export function tryReaddirSync(dir: string | URL | Uri) {
    try {
        if (dir instanceof Uri) {
            if (dir.scheme !== "file") return;
            dir = dir.fsPath;
        }
        return fs.readdirSync(dir);
    }
    catch {
    }
}

export async function tryStatAsync(uri: Uri) {
    try {
        return await workspace.fs.stat(uri);
    }
    catch {
        return undefined;
    }
}

export async function tryReaddirAsync(uri: Uri) {
    try {
        return await workspace.fs.readDirectory(uri);
    }
    catch {
    }
}

export async function* readLines(file: string | Uri) {
    if (typeof file !== "string") {
        yield* vscodeReadLines(file);
        return;
    }

    // if (typeof file !== "string" && file.scheme !== "file") {
    //     yield* vscodeReadLines(file);
    //     return;
    // }

    // const reader = fs.createReadStream(typeof file === "string" ? file : new URL(file.toString()), { encoding: "utf8" });
    const reader = fs.createReadStream(file, { encoding: "utf8" });
    let remaining = "";
    let hasRemaining = false;
    let chunk: string;
    for await (chunk of reader) {
        const lines = chunk.split("\n");
        assert(lines.length > 0);

        // yield all but the last line as it may be continued in the next chunk
        for (let i = 0; i < lines.length - 1; i++) {
            let line = lines[i];
            // if we are resuming a line from a previous chunk, prepend it before yielding
            if (hasRemaining) {
                line = remaining + line;
                remaining = "";
                hasRemaining = false;
            }
            yield line;
        }

        remaining += lines[lines.length - 1];
        hasRemaining = true;
    }
    if (hasRemaining) {
        yield remaining;
    }
}

async function* vscodeReadLines(file: Uri) {
    const data = Buffer.from(await workspace.fs.readFile(file));
    const decoder = new TextDecoder("utf8");
    let start = 0;
    for (let pos = 0; pos < data.length; pos++) {
        if (data[pos] === 0x0d || data[pos] === 0xa) {
            yield decoder.decode(data.slice(start, pos));
            if (data[pos] === 0x0d && pos < data.length - 1 && data[pos+1] === 0x0a) {
                pos++;
            }
            start = pos + 1;
        }
    }
    if (start < data.length) {
        yield decoder.decode(data.slice(start));
    }
}

export function readFileAsync(file: string): Promise<string>;
export function readFileAsync(uri: Uri): Promise<string>;
export async function readFileAsync(uri: Uri | string) {
    if (typeof uri === "string") {
        uri = isUriString(uri) ? Uri.parse(uri, /*strict*/ true) : Uri.file(uri);
    }
    const data = await workspace.fs.readFile(uri);
    return Buffer.from(data).toString("utf8");
}

export function tryReadFileAsync(file: string): Promise<string | undefined>;
export function tryReadFileAsync(uri: Uri): Promise<string | undefined>;
export async function tryReadFileAsync(uri: Uri | string) {
    try {
        return await readFileAsync(uri as string);
    }
    catch {
    }
}

export function writeFileAsync(file: string, content: string): Promise<void>;
export function writeFileAsync(uri: Uri, content: string): Promise<void>;
export async function writeFileAsync(uri: Uri | string, content: string) {
    if (typeof uri === "string") {
        uri = isUriString(uri) ? Uri.parse(uri, /*strict*/ true) : Uri.file(uri);
    }
    await workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
}
