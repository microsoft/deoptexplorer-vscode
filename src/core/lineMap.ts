// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Comparer } from "@esfx/equatable";
import { identity } from "@esfx/fn";
import { Position } from "vscode";
import { binarySearchKey } from "./utils";

export class LineMap {
    private _text: string;
    private _lineStarts: readonly number[] | undefined;

    constructor(text: string) {
        this._text = text;
        this._lineStarts = undefined;
    }

    public get lineStarts() {
        return this.computeLineStarts();
    }

    public get lineCount() {
        return this.computeLineStarts().length;
    }

    public offsetAt(position: Position) {
        this.computeLineStarts();
        if (position.line < 0) return 0;
        if (position.line >= this.lineStarts.length) return this._text.length;
        const linePos = this.lineStarts[position.line];
        const pos = linePos + position.character;
        const lineEnd = position.line + 1 < this.lineStarts.length
            ? this.lineStarts[position.line + 1]
            : this._text.length;
        return pos < linePos ? linePos : pos > lineEnd ? lineEnd : pos;
    }

    public positionAt(offset: number): Position {
        this.computeLineStarts();
        let lineNumber = binarySearchKey(this.lineStarts, offset, identity, Comparer.defaultComparer);
        if (lineNumber < 0) {
            lineNumber = (~lineNumber) - 1;
        }
        return new Position(lineNumber, offset - this.lineStarts[lineNumber]);
    }

    private computeLineStarts() {
        if (this._lineStarts) {
            return this._lineStarts;
        }
        const lineStarts: number[] = [];
        let lineStart = 0;
        for (var pos = 0; pos < this._text.length;) {
            var ch = this._text.charCodeAt(pos++);
            switch (ch) {
                case 13: // CR
                    if (this._text.charCodeAt(pos) === 10) { // LF
                        pos++;
                    }
                case 10: // LF
                case 8232: // LS
                case 8233: // PS
                case 133: // NL
                    lineStarts.push(lineStart);
                    lineStart = pos;
                    break;

            }
        }
        lineStarts.push(lineStart);
        return this._lineStarts = lineStarts;
    }
}
