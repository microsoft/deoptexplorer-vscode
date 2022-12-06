// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { MarkdownString as BaseMarkdownString, Position } from "vscode";
import { assert, assertNever } from "./assert";
import { MarkdownTextWriter } from "./markdownTextWriter";

/**
 * A template string tag that escapes "unsafe" content inside of a markdown document.
 * Use nested tagged templates to switch between safe and unsafe content:
 *
 * ```ts
 * markdown`
 * ## Header
 * ${unsafe}
 * ${markdown`[safe](href)`}
 * `;
 * ```
 *
 * The result is a {@link MarkdownString} of *untrusted* markdown (command links will not
 * be enabled).
 */
export function markdown(array: TemplateStringsArray, ...args: MarkdownValue[]) {
    return makeMarkdown(/*isTrusted*/ false, array, args);
}

export namespace markdown {
    /**
     * Generates a {@link MarkdownString} from a tagged template consisting of a code sample.
     *
     * ```ts
     * markdown.code("typescript")`
     * interface Foo { }
     * `;
     * ```
     *
     * The result is a {@link MarkdownString} of *untrusted* markdown (command links will not
     * be enabled).
     *
     * @param language The language for the code sample.
     */
    export function code(language?: string): (array: TemplateStringsArray, ...args: any[]) => MarkdownString;
    /**
     * Generates a {@link MarkdownString} from a tagged template consisting of a code sample.
     *
     * ```ts
     * markdown.code`
     * code sample
     * `;
     * ```
     *
     * The result is a {@link MarkdownString} of *untrusted* markdown (command links will not
     * be enabled).
     *
     */
    export function code(array: TemplateStringsArray, ...args: any[]): MarkdownString;
    export function code(language?: string | TemplateStringsArray, ...args: any[]) {
        return typeof language === "object" ?
            makeMarkdownCode(/*isTrusted*/ false, /*language*/ undefined, language, args) :
            makeMarkdownCodeFactory(/*isTrusted*/ false, language);
    }

    export namespace code {
        /**
         * Generates a {@link MarkdownString} from a tagged template consisting of a code sample.
         *
         * ```ts
         * markdown.code.trusted("typescript")`
         * interface Foo { }
         * `;
         * ```
         * @param language The language for the code sample.
         *
         * The result is a {@link MarkdownString} of *trusted* markdown (command links will
         * be enabled).
         */
        export function trusted(language?: string): (array: TemplateStringsArray, ...args: any[]) => MarkdownString;
        /**
         * Generates a {@link MarkdownString} from a tagged template consisting of a code sample.
         *
         * ```ts
         * markdown.code.trusted`
         * code sample
         * `;
         * ```
         *
         * The result is a {@link MarkdownString} of *trusted* markdown (command links will
         * be enabled).
         */
        export function trusted(array: TemplateStringsArray, ...args: any[]): MarkdownString;
        export function trusted(language?: string | TemplateStringsArray, ...args: any[]) {
            return typeof language === "object" ?
                makeMarkdownCode(/*isTrusted*/ true, /*language*/ undefined, language, args) :
                makeMarkdownCodeFactory(/*isTrusted*/ true, language);
        }
    }

    export function escaped(array: TemplateStringsArray, ...args: any[]) {
        return makeMarkdownEscaped(/*isTrusted*/ false, array, args);
    }

    export namespace escaped {
        export function trusted(array: TemplateStringsArray, ...args: any[]) {
            return makeMarkdownEscaped(/*isTrusted*/ true, array, args);
        }
    }

    export function table(headers: (string | MarkdownString | MarkdownTableHeader)[], rows: Iterable<Iterable<string | MarkdownString | MarkdownTableCell>>, { html = true } = {}) {
        return makeMarkdownTable(/*isTrusted*/ false, headers, rows, html);
    }

    export namespace table {
        export function trusted(headers: (string | MarkdownString | MarkdownTableHeader)[], rows: Iterable<Iterable<string | MarkdownString | MarkdownTableCell>>, { html = true } = {}) {
            return makeMarkdownTable(/*isTrusted*/ true, headers, rows, html);
        }
    }

    export function trusted(array: TemplateStringsArray, ...args: MarkdownValue[]) {
        return makeMarkdown(/*isTrusted*/ true, array, args);
    }

    export namespace trusted {
        export function code(language?: string): (array: TemplateStringsArray, ...args: any[]) => MarkdownString;
        export function code(array: TemplateStringsArray, ...args: any[]): MarkdownString;
        export function code(language?: string | TemplateStringsArray, ...args: any[]) {
            return typeof language === "object" ?
                makeMarkdownCode(/*isTrusted*/ true, /*language*/ undefined, language, args) :
                makeMarkdownCodeFactory(/*isTrusted*/ true, language);
        }

        export function esacped(array: TemplateStringsArray, ...args: any[]) {
            return makeMarkdownEscaped(/*isTrusted*/ true, array, args);
        }

        export function table(headers: (string | MarkdownString | MarkdownTableHeader)[], rows: Iterable<Iterable<string | MarkdownString | MarkdownTableCell>>, { html = true } = {}) {
            return makeMarkdownTable(/*isTrusted*/ true, headers, rows, html);
        }
    }
}

export interface ToMarkdownString {
    [ToMarkdownString.toMarkdownString](): MarkdownString;
}

export namespace ToMarkdownString {
    export const toMarkdownString = Symbol("ToMarkdownString.toMarkdownString");

    export function hasInstance(value: unknown): value is ToMarkdownString {
        return typeof value === "object"
            && value !== null
            && toMarkdownString in value;
    }
}

export type MarkdownValue =
    | null
    | undefined
    | number
    | boolean
    | bigint
    | string
    | MarkdownString
    | ToMarkdownString
    | { toString(): string }
    | Iterable<MarkdownValue>
    ;

export class MarkdownString extends BaseMarkdownString {
    private _isFrozen = false;

    get isFrozen() {
        return this._isFrozen;
    }

    trust(isTrusted = true) {
        if (this._isFrozen) throw new TypeError();
        this.isTrusted = isTrusted;
        return this;
    }

    appendText(value: string): MarkdownString {
        if (this._isFrozen) throw new TypeError();
        super.appendText(value);
        return this;
    }

    appendMarkdown(value: string): MarkdownString {
        if (this._isFrozen) throw new TypeError();
        super.appendMarkdown(value);
        return this;
    }

    appendCodeblock(value: string, language?: string): MarkdownString {
        if (this._isFrozen) throw new TypeError();
        super.appendCodeblock(value, language);
        return this;
    }

    asFrozen() {
        if (this._isFrozen) return this;
        const copy = new MarkdownString(undefined, this.supportThemeIcons);
        copy.isTrusted = this.isTrusted;
        copy.appendMarkdown(this.value);
        copy._isFrozen = true;
        Object.freeze(copy);
        return copy;
    }

    toString() {
        return this.value;
    }
}

export interface MarkdownTableHeader {
    text: string | MarkdownString;
    align?: "left" | "center" | "right";
    onWrite?: (position: Position, text: string) => void;
}

export interface MarkdownTableCell {
    text: string | MarkdownString;
    onWrite?: (position: Position, text: string) => void;
}

function appendArg(result: MarkdownString, arg: MarkdownValue) {
    if (typeof arg === "object") {
        if (arg === null) {
            return;
        }
        if (ToMarkdownString.hasInstance(arg)) {
            arg = arg[ToMarkdownString.toMarkdownString]();
        }
        if (arg instanceof BaseMarkdownString) {
            assert(!result.isTrusted || arg.isTrusted, "Cannot mix trusted and untrusted content");
            assert(result.supportThemeIcons || !arg.supportThemeIcons, "Cannot mix markdown strings that support theme icons with ones that don't");
            result.appendMarkdown(arg.value);
            return;
        }
        if (Symbol.iterator in arg) {
            for (const item of arg as Iterable<MarkdownValue>) {
                appendArg(result, item);
            }
            return;
        }
    }
    if (arg === undefined) return;

    const markdownString = new MarkdownString(undefined, result.supportThemeIcons);
    markdownString.appendText(`${arg}`);
    result.appendMarkdown(markdownString.value.replace(/~/g, "\\~"));
}

function interpolate(array: TemplateStringsArray, args: any[]) {
    let result = array[0];
    for (let i = 1; i < array.length; i++) {
        result += `${args[i - 1]}${array[i]}`;
    }
    return result;
}

function makeMarkdown(isTrusted: boolean, array: TemplateStringsArray, args: MarkdownValue[]) {
    const result = new MarkdownString(array[0], /*supportThemeIcons*/ true);
    result.isTrusted = isTrusted;
    for (let i = 1; i < array.length; i++) {
        appendArg(result, args[i - 1]);
        result.appendMarkdown(array[i]);
    }
    return result;
}

function makeMarkdownCode(isTrusted: boolean, language: string | undefined, array: TemplateStringsArray, args: any[]) {
    const result = new MarkdownString(undefined, /*supportThemeIcons*/ true);
    result.isTrusted = isTrusted;
    return result.appendCodeblock(interpolate(array, args), language);
}

function makeMarkdownCodeFactory(isTrusted: boolean, language: string | undefined) {
    return (array: TemplateStringsArray, ...args: any[]) => {
        return makeMarkdownCode(isTrusted, language, array, args);
    };
}

function makeMarkdownEscaped(isTrusted: boolean, array: TemplateStringsArray, args: any[]) {
    const result = new MarkdownString(undefined, /*supportThemeIcons*/ true);
    result.isTrusted = isTrusted;
    return result.appendText(interpolate(array, args));
}

function makeMarkdownTable(isTrusted: boolean, headers: (string | MarkdownString | MarkdownTableHeader)[], rows: Iterable<Iterable<string | MarkdownString | MarkdownTableCell>>, html: boolean) {
    const markdownStringCache = new Map<string | MarkdownString | MarkdownTableHeader | MarkdownTableCell, MarkdownString>();
    const columnWidths: number[] = [];
    const headerNames = headers.map(getMarkdownString);
    const headerAlignments = headers.map(getAlignment);
    computeWidths(headerNames);

    const rowsArray: (string | MarkdownString | MarkdownTableCell)[][] = [];
    for (const row of rows) {
        const rowArray = [...row];
        rowsArray.push(rowArray);
        computeWidths(rowArray);
    }

    const writer = new MarkdownTextWriter(undefined, isTrusted);
    writeRow(headerNames);
    writer.writeMarkdown("|");
    for (let i = 0; i < columnWidths.length; i++) {
        const width = columnWidths[i];
        const align = i < headerAlignments.length ? headerAlignments[i] : "left";
        writer.writeMarkdown(align !== "right" ? ":" : "-");
        writer.writeMarkdown("".padEnd(width, "-"));
        writer.writeMarkdown(align !== "left" ? ":" : "-");
        writer.writeMarkdown("|");
    }
    writer.writeLine();
    for (const row of rowsArray) {
        writeRow(row);
    }
    writer.writeLine();
    return new MarkdownString(writer.toString(), /*supportThemeIcons*/ true);

    function wrapUnsafe(cell: string) {
        let result = new MarkdownString(undefined, /*supportThemeIcons*/ true).appendText(cell);
        if (!html) {
            // remove some unnecessary escapes for plain-text tables
            const unescaped = new MarkdownString(undefined, /*supportThemeIcons*/ true);
            unescaped.appendMarkdown(result.value
                .replace(/\\(.)/g, (_, s) => s)
                .replace(/&nbsp;/g, " "));
            result = unescaped;
        }
        result.isTrusted = isTrusted;
        return result;
    }

    function getMarkdownString(cell: string | MarkdownString | MarkdownTableHeader | MarkdownTableCell) {
        let result = markdownStringCache.get(cell);
        if (result) return result;
        result =
            typeof cell === "string" ? wrapUnsafe(cell) :
            cell instanceof MarkdownString ? cell :
            typeof cell.text === "string" ? wrapUnsafe(cell.text) :
            cell.text instanceof MarkdownString ? cell.text :
            assertNever(cell.text);
        result = result.asFrozen();
        markdownStringCache.set(cell, result);
        return result;
    }

    function getLength(cell: string | MarkdownString | MarkdownTableHeader | MarkdownTableCell) {
        return getMarkdownString(cell).value.length;
    }

    function getAlignment(cell: string | MarkdownString | MarkdownTableHeader | MarkdownTableCell) {
        return (typeof cell === "string" || cell instanceof MarkdownString ? undefined : "align" in cell ? cell.align : undefined) ?? "left";
    }

    function getOnWrite(cell: string | MarkdownString | MarkdownTableHeader | MarkdownTableCell) {
        return typeof cell === "string" || cell instanceof MarkdownString ? undefined : cell.onWrite;
    }

    function computeWidths(row: (string | MarkdownString | MarkdownTableHeader | MarkdownTableCell)[]) {
        for (let i = 0; i < row.length; i++) {
            if (columnWidths.length <= i) {
                columnWidths[i] = 0;
            }
            columnWidths[i] = Math.max(columnWidths[i], getLength(row[i]));
        }
    }

    function writeRow(row: (string | MarkdownString | MarkdownTableHeader | MarkdownTableCell)[]) {
        writer.writeMarkdown("|");
        for (let i = 0; i < columnWidths.length; i++) {
            const width = columnWidths[i];
            const header = i < headers.length ? headers[i] : "";
            const cell = i < row.length ? row[i] : "";
            const markdownString = getMarkdownString(cell);
            const align = i < headerAlignments.length ? headerAlignments[i] : "left";
            writer.writeMarkdown(" ");
            const leftPad =
                align === "left" ? 0 :
                align === "right" ? Math.max(0, width - markdownString.value.length) :
                Math.max(0, Math.floor((width - markdownString.value.length) / 2));
            const rightPad =
                align === "left" ? Math.max(0, width - markdownString.value.length) :
                align === "right" ? 0 :
                Math.max(0, width - markdownString.value.length - leftPad);
            writer.writeMarkdown("".padEnd(leftPad, " "));
            getOnWrite(header)?.(new Position(writer.line, writer.column), markdownString.value);
            getOnWrite(cell)?.(new Position(writer.line, writer.column), markdownString.value);
            writer.write(markdownString);
            writer.writeMarkdown("".padEnd(rightPad, " "));
            writer.writeMarkdown(" |");
        }
        writer.writeLine();
    }
}
