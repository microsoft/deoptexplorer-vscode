// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { DeoptEntry } from "#deoptigate/deoptEntry.js";
import { FunctionEntry } from "#deoptigate/functionEntry.js";
import { IcEntry } from "#deoptigate/icEntry.js";

/**
 * Contains everything we know about a file (except for profile events)
 */
export interface FileEntry {
    functions: FunctionEntry[];
    ics: IcEntry[];
    deopts: DeoptEntry[];
}
