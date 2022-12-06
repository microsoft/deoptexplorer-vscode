// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "./assert";
import { MarkdownString } from "./markdown";

export class MarkdownTextWriter {
    private markdown = new MarkdownString(undefined, /*supportThemeIcons*/ true);
    private lineStart = false;
    private lineCount = 0;
    private linePos = 0;

    constructor(text = "", isTrusted = false) {
        this.markdown.isTrusted = isTrusted;
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
            this.linePos = this.markdown.value.length - s.length + lineStartsOfS[lineStartsOfS.length - 1];
            this.lineStart = (this.linePos - this.markdown.value.length) === 0;
        }
        else {
            this.lineStart = false;
        }
    }

    get length() { return this.markdown.value.length; }
    get line() { return this.lineCount; }
    get column() { return this.markdown.value.length - this.linePos; }

    write(chunk: string | MarkdownString) {
        this._write(chunk, /*raw*/ false);
    }
    
    writeMarkdown(chunk: string) {
        this._write(chunk, /*raw*/ true);
    }

    private _write(chunk: string | MarkdownString, raw: boolean) {
        if (typeof chunk === "string") {
            if (chunk.length) {
                if (this.lineStart) {
                    this.lineStart = false;
                }
                if (raw) {
                    this.markdown.appendMarkdown(chunk);
                    this.updateLineCountAndPosFor(chunk);
                }
                else {
                    const start = this.markdown.value.length;
                    this.markdown.appendText(chunk);
                    this.updateLineCountAndPosFor(this.markdown.value.slice(start));
                }
            }
        }
        else {
            assert(!this.markdown.isTrusted || chunk.isTrusted, "Cannot mix trusted and untrusted content");
            assert(this.markdown.supportThemeIcons || !chunk.supportThemeIcons, "Cannot mix markdown strings that support theme icons with ones that don't");
            if (chunk.value.length) {
                if (this.lineStart) {
                    this.lineStart = false;
                }
                this.markdown.appendMarkdown(chunk.value);
                this.updateLineCountAndPosFor(chunk.value);
            }
        }
    }

    writeLine() {
        this.markdown.appendMarkdown("\n");
        this.lineCount++;
        this.linePos = this.markdown.value.length;
        this.lineStart = true;
    }

    toMarkdownString() {
        const result = new MarkdownString(undefined, /*supportThemeIcons*/ true).appendMarkdown(this.markdown.value);
        result.isTrusted = this.markdown.isTrusted;
        return result;
    }

    toString() {
        return this.markdown.value;
    }
}
