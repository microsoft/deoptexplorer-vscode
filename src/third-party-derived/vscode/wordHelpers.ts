// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
//
// THIRD PARTY LICENSE NOTICE:
//
// Portions of this code are sourced from Visual Studio Code:
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//  Licensed under the MIT License. See LICENSE.vscode in the project root for license information.

const maxLen = 1000;
const timeBudget = 150;
const windowSize = 15;

export interface IWordAtPosition {
    word: string;
    /** 1-based column number */
    startColumn: number;
    /** 1-based column number */
    endColumn: number;
}

// source: https://github.com/microsoft/vscode/blob/45aafeb326d0d3d56cbc9e2932f87e368dbf652d/src/vs/editor/common/model/wordHelper.ts#L64
export function getWordAtText(column: number, wordDefinition: RegExp, text: string): IWordAtPosition | null {
    let textOffset = 0;
    if (text.length > maxLen) {
        let start = column - maxLen / 2;
        if (start < 0) {
            start = 0;
        }
        else {
            textOffset += start;
        }
        text = text.substring(start, column + maxLen / 2);
    }
    const t1 = Date.now();
    const pos = column - 1 - textOffset;
    let prevRegexIndex = -1;
    let match: RegExpExecArray | null = null;
    for (let i = 1; ; i++) {
        if (Date.now() - t1 >= timeBudget) {
            break;
        }
        const regexIndex = pos - windowSize * i;
        wordDefinition.lastIndex = Math.max(0, regexIndex);
        const thisMatch = _findRegexMatchEnclosingPosition(wordDefinition, text, pos, prevRegexIndex);
        if (!thisMatch && match) {
            break;
        }
        match = thisMatch;
        if (regexIndex <= 0) {
            break;
        }
        prevRegexIndex = regexIndex;
    }
    if (match) {
        const result: IWordAtPosition = {
            word: match[0],
            startColumn: textOffset + 1 + match.index,
            endColumn: textOffset + 1 + match.index + match[0].length
        };
        wordDefinition.lastIndex = 0;
        return result;
    }
    return null;
}

function _findRegexMatchEnclosingPosition(wordDefinition: RegExp, text: string, pos: number, stopPos: number): RegExpExecArray | null {
    let match: RegExpExecArray | null;
    while (match = wordDefinition.exec(text)) {
        if (match.index <= pos && wordDefinition.lastIndex >= pos) {
            break;
        }
        else if (stopPos > 0 && match.index > stopPos) {
            match = null;
            break;
        }
    }
    return match;
}
