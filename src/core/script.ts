// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Uri } from "vscode";
import { assert } from "./assert";
import { LineMap } from "./lineMap";

export class Script {
    private _lineMap: LineMap | undefined;

    constructor(
        readonly scriptId: number,
        readonly uri: Uri | undefined,
        readonly text: string
    ) {
        assert(scriptId >= 0);
    }

    get lineMap() {
        return this._lineMap ??= new LineMap(this.text);
    }

    // line numbers in v8 are 1-based, line numbers in VSCode are 0-based
    getV8LineNumber(offset: number) {
        const position = this.lineMap.positionAt(offset);
        return position.line + 1;
    }
}
