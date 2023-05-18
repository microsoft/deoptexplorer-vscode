// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import path from "path";
import fs from "fs";
import Registry = require("winreg");

declare global {
    var Deno: { version?: { v8?: string; }; } | undefined;
}

export const isDeno = typeof globalThis.Deno?.version?.v8 === "string";
export const isElectron = !!process.versions.electron;
export const isNodeJS = !!process.versions.node && !isElectron && !isDeno;

export function canAccess(file: string, mode: "write" | "exec") {
    try {
        const modenum = mode === "exec" ? fs.constants.X_OK : fs.constants.W_OK;
        fs.accessSync(file, modenum);
        return true;
    }
    catch {
        return false;
    }
}

export async function regQuery(hive: string, key: string, valueName: string = Registry.DEFAULT_VALUE) {
    const reg = new Registry({ hive, key });
    const keyExists = await new Promise<boolean>((res, rej) => reg.keyExists((err, exists) => err ? rej(err) : res(exists)));
    if (!keyExists) return undefined;

    const valueExists = await new Promise<boolean>((res, rej) => reg.valueExists(valueName, (err, exists) => err ? rej(err) : res(exists)));
    if (!valueExists) return undefined;

    const value = await new Promise<string>((res, rej) => reg.get(valueName, (err, item) => err ? rej(err) : res(item.value)));
    return value;
}

export function unquote(candidate: string) {
    if (candidate.length >= 2 && candidate.charAt(0) === '"' && candidate.charAt(candidate.length - 1) === '"') {
        return candidate.slice(1, -1);
    }
    return candidate;
}

const ALT_PATH_SEP = path.sep !== path.posix.sep ? path.posix.sep : undefined;

export function which(execPath: string) {
    execPath = unquote(execPath);

    // If the path includes a separator, do not try to resolve it.
    if (execPath.includes(path.sep) || (ALT_PATH_SEP && execPath.includes(ALT_PATH_SEP))) {
        execPath = path.resolve(execPath);
        return canAccess(execPath, "exec") ? path.resolve(execPath) : undefined;
    }

    const PATH = (process.env.PATH ?? "").split(path.delimiter).map(unquote);
    const PATHEXT = (process.env.PATHEXT ?? "").split(";").map(unquote);
    const extname = path.extname(execPath);
    const basePathCandidates = [process.cwd(), ...PATH];
    const extnameCandidates = extname ? ["", ...PATHEXT] : PATHEXT;
    for (const basePathCandidate of basePathCandidates) {
        for (const extnameCandidate of extnameCandidates) {
            const candidate = path.resolve(basePathCandidate, execPath + extnameCandidate);
            if (canAccess(candidate, "exec")) {
                return candidate;
            }
        }
    }
}
