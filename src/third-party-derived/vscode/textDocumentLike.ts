// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
//
// THIRD PARTY LICENSE NOTICE:
//
// Portions of this code are sourced from Visual Studio Code:
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//  Licensed under the MIT License. See LICENSE.vscode in the project root for license information.

import { assert } from "#core/assert.js";
import { LineMap } from "#core/lineMap.js";
import { Sources } from "#core/sources.js";
import { isJavaScriptFile, isJsxFile, isTsxFile, isTypeScriptFile } from "#core/uri.js";
import { pathOrUriStringToUri, UNKNOWN_URI, uriToPathOrUriString } from "#extension/vscode/uri.js";
import * as ts from "typescript";
import { EndOfLine, Position, Range, TextDocument, TextLine, Uri } from "vscode";
import { getWordAtText } from "./wordHelpers";

const isWindows = process.platform === "win32";
const WORD_REGEXP = /(-?\d*\.\d\w*)|([^-=+~!@#$%^&*|;:`'",.<>?(){}[\]\\\/\s]+)/g;
const CR = "\r".charCodeAt(0);
const LF = "\n".charCodeAt(0);

abstract class TextDocumentSourceBase {
    private _sourceFileSource: SourceFileTextDocumentSource | undefined;

    constructor(
        protected readonly _sources?: Sources
    ) {
    }

    abstract get uri(): Uri;
    abstract get text(): string;
    abstract offsetAt(position: Position): number;
    abstract positionAt(offset: number): Position;
    abstract getLineStarts(): readonly number[];

    getEndOfLine() {
        const lineStarts = this.getLineStarts();
        let lfCount = 0;
        let crlfCount = 0;
        for (let i = 1; i < lineStarts.length; i++) {
            let lineEnd = lineStarts[i];
            let ch = this.text.charCodeAt(lineEnd - 1);
            if (ch === CR) {
                crlfCount++;
                continue;
            }
            if (ch === LF) {
                if (lineEnd > 1 && this.text.charCodeAt(lineEnd - 2) === CR) {
                    crlfCount++;
                    continue;
                }
                lfCount++;
            }
        }
        return crlfCount > lfCount ? EndOfLine.CRLF :
            lfCount > crlfCount ? EndOfLine.LF :
            isWindows ? EndOfLine.CRLF :
            EndOfLine.LF;
    }

    getLanguageId(): string {
        const uri = this.uri;
        return isTsxFile(uri) ? "typescriptreact" :
            isTypeScriptFile(uri) ? "typescript" :
            isJsxFile(uri) ? "javascriptreact" :
            isJavaScriptFile(uri) ? "javascript" :
            "text";
    }

    getSourceFileTextDocumentSource() {
        if (!this._sourceFileSource) {
            const uri = this.uri;
            this._sourceFileSource = new SourceFileTextDocumentSource(
                this._sources?.getExistingSourceFile(uri) || ts.createSourceFile(
                    uriToPathOrUriString(uri),
                    this.text,
                    ts.ScriptTarget.Latest,
                    /*setParentNodes*/ true,
                    isTsxFile(uri) ? ts.ScriptKind.TSX :
                    isTypeScriptFile(uri) ? ts.ScriptKind.TS :
                    isJsxFile(uri) ? ts.ScriptKind.JSX :
                    isJavaScriptFile(uri) ? ts.ScriptKind.JS :
                    undefined
                ),
                uri
            );
        }
        return this._sourceFileSource;
    }
}

class SourceFileTextDocumentSource extends TextDocumentSourceBase {
    constructor(
        readonly sourceFile: ts.SourceFile,
        private _uri: Uri | undefined
    ) {
        super();
    }

    get uri() {
        return this._uri ??= pathOrUriStringToUri(this.sourceFile.fileName);
    }

    get text() {
        return this.sourceFile.text;
    }

    offsetAt(position: Position) {
        return this.sourceFile.getPositionOfLineAndCharacter(position.line, position.character, /*allowEdits*/ true);
    }

    positionAt(offset: number) {
        const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(offset);
        return new Position(line, character);
    }

    getLineStarts() {
        return this.sourceFile.getLineStarts();
    }

    getSourceFileTextDocumentSource() {
        return this;
    }
}

class StringTextDocumentSource extends TextDocumentSourceBase {
    constructor(
        private _uri: Uri,
        private _text: string,
        sources?: Sources,
        private _lineMap?: LineMap
    ) {
        super(sources);
    }

    get uri() {
        return this._uri;
    }

    get text() {
        return this._text;
    }

    private get lineMap() {
        return this._lineMap ||= this._sources?.getExistingLineMap(this._uri) || new LineMap(this._text);
    }

    offsetAt(position: Position) {
        return this.lineMap.offsetAt(position);
    }

    positionAt(offset: number) {
        return this.lineMap.positionAt(offset);
    }

    getLineStarts() {
        return this.lineMap.lineStarts;
    }
}

export class TextDocumentLike implements TextDocument {
    private _fileName: string | undefined;
    private _languageId: string | undefined;
    private _eol: EndOfLine | undefined;
    private _lineCount: number | undefined;

    private constructor(private _source: TextDocumentSourceBase) {
    }

    static fromSourceFile(sourceFile: ts.SourceFile, uri?: Uri) {
        return new TextDocumentLike(new SourceFileTextDocumentSource(sourceFile, uri));
    }

    static fromString(text: string, uri: Uri = UNKNOWN_URI, lineMap?: LineMap) {
        return new TextDocumentLike(new StringTextDocumentSource(uri, text, /*sources*/ undefined, lineMap));
    }

    static fromSource(sources: Sources, uri: Uri) {
        const text = sources.getExistingContent(uri);
        if (text === undefined) return undefined;
        return new TextDocumentLike(new StringTextDocumentSource(uri, text, sources));
    }

    get uri() {
        return this._source.uri;
    }

    get fileName() {
        return this._fileName ??= uriToPathOrUriString(this._source.uri);
    }

    get isUntitled() {
        return false;
    }

    get languageId() {
        return this._languageId ??= this._source.getLanguageId();
    }

    get version() {
        return 1;
    }

    get isDirty() {
        return false;
    }

    get isClosed() {
        return true;
    }

    get eol() {
        return this._eol ??= this._source.getEndOfLine();
    }

    get lineCount() {
        return this._lineCount ??= this._source.getLineStarts().length;
    }

    save(): Promise<boolean> {
        return Promise.resolve(false);
    }

    lineAt(line: number): TextLine;
    lineAt(position: Position): TextLine;
    lineAt(lineOrPosition: number | Position): TextLineLike {
        const line =
            lineOrPosition instanceof Position ? lineOrPosition.line :
            typeof lineOrPosition === "number" ? lineOrPosition :
            undefined;
        if (line === undefined ||
            line < 0 ||
            line >= this._source.getLineStarts().length ||
            line !== Math.floor(line)
        ) {
            throw new RangeError();
        }
        const lineStarts = this._source.getLineStarts();
        return new TextLineLike(line, this._getLine(line, lineStarts), line === lineStarts.length - 1);
    }

    offsetAt(position: Position) {
        return this._source.offsetAt(this.validatePosition(position));
    }

    positionAt(offset: number) {
        offset = Math.floor(offset);
        offset = Math.max(0, offset);
        return this._source.positionAt(offset);
    }

    getText(range?: Range) {
        if (!range) return this._source.text;
        range = this.validateRange(range);
        if (range.isEmpty) return "";
        return this._source.text.slice(this.offsetAt(range.start), this.offsetAt(range.end));
    }

    getWordRangeAtPosition(position: Position, regex?: RegExp) {
        position = this.validatePosition(position);
        const lineStarts = this._source.getLineStarts();
        const text = this._source.text;
        const lineStart = this._getLineStart(position.line, lineStarts);
        const lineEnd = this._getLineEnd(position.line, lineStarts);
        const line = text.slice(lineStart, lineEnd);

        if (!regex) {
            regex = WORD_REGEXP;
        }
        else {
            regex.lastIndex = 0;
            if (regex.test("") && regex.lastIndex === 0) {
                throw new Error("Ignoring custom regexp because it matches the empty string.");
            }
            if (!regex.global || regex.sticky) {
                let flags = "g";
                if (regex.ignoreCase) flags += "i";
                if (regex.multiline) flags += "m";
                if (regex.unicode) flags += "u";
                regex = new RegExp(regex.source, flags);
            }
        }
        regex.lastIndex = position.character;
        const wordAtText = getWordAtText(position.character + 1, regex, line);
        if (wordAtText) {
            return new Range(position.line, wordAtText.startColumn - 1, position.line, wordAtText.endColumn - 1);
        }
    }

    validateRange(range: Range) {
        return range.with(this.validatePosition(range.start), this.validatePosition(range.end));
    }

    validatePosition(position: Position) {
        if (this._source.text.length === 0) {
            return position.with(0, 0);
        }
        let { line, character } = position;
        if (line < 0) {
            line = 0;
            character = 0;
        }
        else {
            const lineStarts = this._source.getLineStarts();
            const lineCount = lineStarts.length;
            if (line >= lineCount) {
                line = lineCount - 1;
                character = this._getLineLength(line, lineStarts);
            }
            else if (character < 0) {
                character = 0;
            }
            else {
                const lineLength = this._getLineLength(line, lineStarts);
                if (character > lineLength) {
                    character = lineLength;
                }
            }
        }
        return position.with(line, character);
    }

    // tokenAt(position: Position) {
    //     const source = this._source.getSourceFileTextDocumentSource();
    //     const offset = source.offsetAt(position);
    //     return ts.getTokenAtPosition(source.sourceFile, offset);
    // }

    // precedingTokenAt(position: Position) {
    //     const source = this._source.getSourceFileTextDocumentSource();
    //     const offset = source.offsetAt(position);
    //     return ts.findPrecedingToken(offset, source.sourceFile, /*startNode*/ undefined, /*excludeJsdoc*/ true);
    // }

    /**
     * Gets the text offset of the start of the line.
     */
    private _getLineStart(line: number, lineStarts: readonly number[]) {
        assert(line >= 0 && line < lineStarts.length);
        return lineStarts[line];
    }

    /**
     * Gets the text offset of the end of the line, excluding line terminators.
     */
    private _getLineEnd(line: number, lineStarts: readonly number[]) {
        const lineCount = lineStarts.length;
        assert(line >= 0 && line < lineCount);
        const text = this._source.text;
        if (line === lineCount - 1) return text.length;
        const lineStart = lineStarts[line];
        let lineEnd = lineStarts[line + 1];
        while (lineEnd > lineStart) {
            const ch = text.charCodeAt(lineEnd - 1);
            if (ch === CR || ch === LF) {
                lineEnd--;
                continue;
            }
            break;
        }
        return lineEnd;
    }

    /**
     * Get the length of a line, excluding line terminators.
     */
    private _getLineLength(line: number, lineStarts: readonly number[]) {
        const lineStart = this._getLineStart(line, lineStarts);
        const lineEnd = this._getLineEnd(line, lineStarts);
        return lineEnd - lineStart;
    }

    private _getLine(line: number, lineStarts: readonly number[]) {
        const lineStart = this._getLineStart(line, lineStarts);
        const lineEnd = this._getLineEnd(line, lineStarts);
        return this._source.text.slice(lineStart, lineEnd);
    }
}

class TextLineLike implements TextLine {
    private _range: Range | undefined;
    private _rangeIncludingLineBreak: Range | undefined;
    private _firstNonWhitespaceCharacterIndex: number | undefined;

    constructor(
        private _line: number,
        private _text: string,
        private _isLastLine: boolean
    ) {
    }

    get lineNumber() {
        return this._line; 
    }

    get text() {
        return this._text; 
    }

    get range() {
        return this._range ??= new Range(this._line, 0, this._line, this._text.length); 
    }

    get rangeIncludingLineBreak() {
        return this._isLastLine ? this.range : this._rangeIncludingLineBreak ??= new Range(this._line, 0, this._line + 1, 0); 
    }

    get firstNonWhitespaceCharacterIndex() {
        return this._firstNonWhitespaceCharacterIndex ??= /^(\s*)/.exec(this._text)![1].length;
    }

    get isEmptyOrWhitespace() {
        return this.firstNonWhitespaceCharacterIndex === this._text.length;
    }
}
