// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Position, Uri } from "vscode";
import { Entry } from "../model/entry";

export function entryContainsPosition(entry: Entry, file: Uri, startLine: number, endLine: number, position: Position) {
    const kind = entry.getLocationKind(file);
    const location = entry.getLocation(kind);
    return location &&
        location.range.start.line >= startLine &&
        location.range.start.line <= endLine &&
        !!entry.getReferenceLocation(kind)?.range.contains(position);
}
