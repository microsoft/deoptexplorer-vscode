// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ConfigurationScope, workspace } from "vscode";
import * as constants from "./constants";

function get<T>(scope: ConfigurationScope | undefined | null, key: string, defaultValue: T) {
    return workspace.getConfiguration(constants.extensionName, scope).get<T>(key, defaultValue);
}

/**
 * Gets the path to `DUMPBIN.exe` (included in the MSVC tools). If not provided, Deopt Explorer will attempt to search for a Visual Studio installation containing these tools when they are needed.
 */
export function getDumpbinPath(scope?: ConfigurationScope | null) {
    return get<string | null>(scope, constants.configurationKeys.dumpbinPath, null);
}

/**
 * Whether to attempt include native symbols in a profile when parsing a log file. This differs from the 'Just My Code' setting which determines the visibility of these symbols.
 */
export function getIncludeNatives(scope?: ConfigurationScope | null) {
    return get<boolean>(scope, constants.configurationKeys.includeNatives, false);
}
