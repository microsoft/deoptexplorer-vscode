// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Uri } from "vscode";

let dbghelpWrapper: typeof import("./dbghelpWrapper.js") | undefined;
let hasReportedError = false;

export async function tryCreateDbghelpWrapper(extensionUri: Uri) {
    if (process.platform !== "win32") return undefined;
    try {
        dbghelpWrapper ??= await import("./dbghelpWrapper.js");
        return new dbghelpWrapper.DbghelpWrapper(extensionUri);
    }
    catch {
        if (!hasReportedError) {
            hasReportedError = true;
            console.error("Failed to load win32 native binaries. They may be missing or may not match the current electron ABI.");
        }

        return undefined;
    }
}
