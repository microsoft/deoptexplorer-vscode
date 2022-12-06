// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Position, Range } from "vscode";

export class TextWriter {
    private text = "";
    private lineStart = false;
    private lineCount = 0;
    private linePos = 0;

    constructor(text = "") {
        this.write(text);
    }

    private computeLineStarts(text: string): number[] {
        const result: number[] = new Array();
        let pos = 0;
        let lineStart = 0;
        while (pos < text.length) {
            const ch = text.charCodeAt(pos);
            pos++;
            switch (ch) {
                case 0x0d:
                    if (text.charCodeAt(pos) === 0x0a) {
                        pos++;
                    }
                    // falls through
                case 0x0a:
                    result.push(lineStart);
                    lineStart = pos;
                    break;
                default:
                    if (ch === 0x2028 || ch === 0x2029) {
                        result.push(lineStart);
                        lineStart = pos;
                    }
                    break;
            }
        }
        result.push(lineStart);
        return result;
    }

    private updateLineCountAndPosFor(s: string) {
        const lineStartsOfS = this.computeLineStarts(s);
        if (lineStartsOfS.length > 1) {
            this.lineCount = this.lineCount + lineStartsOfS.length - 1;
            this.linePos = this.text.length - s.length + lineStartsOfS[lineStartsOfS.length - 1];
            this.lineStart = (this.linePos - this.text.length) === 0;
        }
        else {
            this.lineStart = false;
        }
    }

    get length() { return this.text.length; }
    get line() { return this.lineCount; }
    get column() { return this.text.length - this.linePos; }

    write(text: string, cb?: (range: Range) => void) {
        if (text.length) {
            if (this.lineStart) {
                this.lineStart = false;
            }
            const startLine = this.line;
            const startColumn = this.column;
            this.text += text;
            this.updateLineCountAndPosFor(text);
            cb?.(new Range(startLine, startColumn, this.line, this.column));
        }
    }

    writeLine() {
        this.text += "\n";
        this.lineCount++;
        this.linePos = this.text.length;
        this.lineStart = true;
    }

    toString() {
        return this.text;
    }
}
