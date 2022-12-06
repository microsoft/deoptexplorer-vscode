// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { FunctionEntry } from "../../third-party-derived/deoptigate/functionEntry";
import { IcEntry } from "../../third-party-derived/deoptigate/icEntry";
import { DeoptEntry } from "../../third-party-derived/deoptigate/deoptEntry";

/**
 * Contains everything we know about a file (except for profile events)
 */
export interface FileEntry {
    functions: FunctionEntry[];
    ics: IcEntry[];
    deopts: DeoptEntry[];
}
