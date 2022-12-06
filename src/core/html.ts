// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "./assert";

/**
 * A template string tag that escapes "unsafe" content inside of an html document.
 * Use nested tagged templates to switch between safe and unsafe content:
 * 
 * ```ts
 * html`
 *   <div>
 *     ${unsafe}
 *     ${html`<span>safe</span>`}
 *   </div>
 * `;
 * ```
 */
export function html(array: TemplateStringsArray, ...args: HtmlValue[]) {
    const result = new HtmlString(array[0]);
    for (let i = 1; i < array.length; i++) {
        appendArg(result, args[i - 1]);
        result.appendHtml(array[i]);
    }
    return result;
}

/**
 * An allowed value in an `html` tagged template string.
 */
export type HtmlValue =
    | null
    | undefined
    | number
    | boolean
    | bigint
    | string
    | HtmlString
    | Iterable<HtmlValue>
    | { toString(): string }
    ;

/**
 * Represents a "safe" chunk of HTML content. When interpolated in a template string using the
 * {@link html} template tag, the content of an {@link HtmlString} will not be escaped.
 */
export class HtmlString {
    value: string;
    isTrusted?: boolean;

    constructor(value = "") {
        this.value = value;
    }

    static htmlEncode(text: string) {
        return text.replace(/[<>"'&]/g, s => {
            return s === "<" ? "&lt;" :
                s === ">" ? "&gt;" :
                s === "\"" ? "&quot;" :
                s === "'" ? "&apos;" :
                s === "&" ? "&amp;" :
                s;
        });
    }

    appendText(text: string) {
        this.value += HtmlString.htmlEncode(text);
        return this;
    }

    appendHtml(text: string) {
        this.value += text;
        return this;
    }

    toString() {
        return this.value;
    }
}

function appendArg(result: HtmlString, arg: HtmlValue) {
    if (typeof arg === "object") {
        if (arg === null) {
            return;
        }
        if (arg instanceof HtmlString) {
            assert(!result.isTrusted || arg.isTrusted, "Cannot mix trusted and untrusted content");
            result.appendHtml(arg.value);
            return;
        }
        if (Symbol.iterator in arg) {
            for (const item of arg as Iterable<HtmlValue>) {
                appendArg(result, item);
            }
            return;
        }
    }
    if (arg !== undefined) {
        result.appendText(`${arg}`);
    }
}
