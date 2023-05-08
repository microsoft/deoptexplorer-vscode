// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// TODO: Most of this isn't working anymore in the latest VS Code because `ref-napi` and `ffi-napi` haven't been
//       updated to support newer versions of electron.

import type { ExtensionContext } from "vscode";
import type { WindowsCppEntriesProviderOptions } from "./windowsCppEntriesProvider";
export type { WindowsCppEntriesProvider, WindowsCppEntriesProviderOptions } from "./windowsCppEntriesProvider";

let lazyWindowsCppEntriesProvider: typeof import("./windowsCppEntriesProvider").WindowsCppEntriesProvider | undefined;
let lazyActivateDbgHelp: typeof import("./api/dbghelp").activateDbgHelp | undefined;

export async function activateWin32(context: ExtensionContext) {
    if (process.platform !== "win32") throw new Error("Wrong platform.");
    lazyActivateDbgHelp ??= (await import("./api/dbghelp")).activateDbgHelp;
    return lazyActivateDbgHelp(context);
}

export async function createWindowsCppEntriesProvider(options: WindowsCppEntriesProviderOptions) {
    if (process.platform !== "win32") throw new Error("Wrong platform.");
    lazyWindowsCppEntriesProvider ??= (await import("./windowsCppEntriesProvider")).WindowsCppEntriesProvider;
    return new lazyWindowsCppEntriesProvider(options);
}
