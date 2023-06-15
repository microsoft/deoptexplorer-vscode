// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Comparer, Equaler } from "@esfx/equatable";
import { Reference } from "@esfx/ref";
import { KnownSerializedType, RegisteredSerializer, registerKnownSerializer } from "#core/serializer.js";
import { hashNullable } from "#core/utils.js";
import { Position, Range } from "vscode";
import { PositionEqualer, PositionSerializer } from "./position";

const trailingRangeRegExp = /:(?<line>\d+)(?::(?<column>\d+)(?::(?<endLine>\d+)(?::(?<endColumn>\d+))?)?)?$/;

/**
 * Attempts to parse a trailing range from a string, such as `foo:1:1:1:1` into `new Range(new Position(0, 0), new Position(0, 0))`.
 *
 * **NOTE:** Line and character offsets in the incoming string are 1-based, but VS Code positions are 0-based.
 *
 * Will parse the following trailing strings:
 * - `:10` -> `new Range(new Position(9, 0), new Position(9, 0))`
 * - `:10:20` -> `new Range(new Position(9, 19), new Position(9, 19))`
 * - `:10:20:11` -> `new Range(new Position(9, 19), new Position(11, 0))`
 * - `:10:20:11:30` -> `new Range(new Position(9, 19), new Position(11, 29))`
 *
 * @param text The text to parse.
 * @param out_prefixLength A {@link Reference} to an output value indicating where the trailing range started.
 * @returns A {@link Range}, if one could be parsed. Otherwise, `undefined`.
 */
export function tryParseTrailingRange(text: string, out_prefixLength?: Reference<number>) {
    const match = trailingRangeRegExp.exec(text);
    if (match?.groups) {
        const { line, column, endLine, endColumn } = match.groups;
        if (out_prefixLength) out_prefixLength.value = match.index;
        const start = new Position(
            Math.max(0, parseInt(line, 10) - 1),
            column ? Math.max(0, parseInt(column, 10) - 1) : 0
        );
        let endLineNumber: number;
        const end = endLine ?
            new Position(
                endLineNumber = Math.max(0, parseInt(endLine, 10) - 1),
                endColumn ? Math.max(0, parseInt(endColumn, 10) - 1) :
                    endLineNumber === start.line ? start.character :
                    0
            ) : start;
        return new Range(start, end);
    }
}

const rangeRegExp = /^:?(?<line>\d+)(?::(?<column>\d+)(?::(?<endLine>\d+)(?::(?<endColumn>\d+))?)?)?$/;

/**
 * Attempts to parse a range from a string, such as `:1:1:1:1` or `1:1:1:1` into `new Range(new Position(0, 0), new Position(0, 0))`.
 *
 * **NOTE:** Line and character offsets in the incoming string are 1-based, but VS Code positions are 0-based.
 *
 * Will parse the following strings:
 * - `:10` -> `new Range(new Position(9, 0), new Position(9, 0))`
 * - `:10:20` -> `new Range(new Position(9, 19), new Position(9, 19))`
 * - `:10:20:11` -> `new Range(new Position(9, 19), new Position(11, 0))`
 * - `:10:20:11:30` -> `new Range(new Position(9, 19), new Position(11, 29))`
 * - `10` -> `new Range(new Position(9, 0), new Position(9, 0))`
 * - `10:20` -> `new Range(new Position(9, 19), new Position(9, 19))`
 * - `10:20:11` -> `new Range(new Position(9, 19), new Position(11, 0))`
 * - `10:20:11:30` -> `new Range(new Position(9, 19), new Position(11, 29))`
 *
 * @param text The text to parse.
 * @returns A {@link Range}, if one could be parsed. Otherwise, `undefined`.
 */
export function tryParseRange(text: string) {
    const match = rangeRegExp.exec(text);
    if (match?.groups) {
        const { line, column, endLine, endColumn } = match.groups;
        let endLineNumber: number;
        const start = new Position(parseInt(line, 10), column ? parseInt(column, 10) : 0);
        const end = endLine ? new Position(endLineNumber = parseInt(endLine, 10), endColumn ? parseInt(endColumn, 10) : endLineNumber === start.line ? start.character : 0) : start;
        return new Range(start, end);
    }
}

/**
 * Parses a range from a string, such as `:1:1:1:1` or `1:1:1:1` into `new Range(new Position(0, 0), new Position(0, 0))`.
 *
 * **NOTE:** Line and character offsets in the incoming string are 1-based, but VS Code positions are 0-based.
 *
 * Will parse the following strings:
 * - `:10` -> `new Range(new Position(9, 0), new Position(9, 0))`
 * - `:10:20` -> `new Range(new Position(9, 19), new Position(9, 19))`
 * - `:10:20:11` -> `new Range(new Position(9, 19), new Position(11, 0))`
 * - `:10:20:11:30` -> `new Range(new Position(9, 19), new Position(11, 29))`
 * - `10` -> `new Range(new Position(9, 0), new Position(9, 0))`
 * - `10:20` -> `new Range(new Position(9, 19), new Position(9, 19))`
 * - `10:20:11` -> `new Range(new Position(9, 19), new Position(11, 0))`
 * - `10:20:11:30` -> `new Range(new Position(9, 19), new Position(11, 29))`
 *
 * @param text The text to parse.
 * @returns The resulting {@link Range}.
 * @throws {@link SyntaxError} - Invalid Range
 */
export function parseRange(text: string) {
    const range = tryParseRange(text);
    if (!range) throw new SyntaxError(`Invalid range: ${text}`);
    return range;
}

export interface FormatRangeOptions {
    /**
     * Indicates how the range should be formatted (default `"range"`):
     * 
     * - `"line"` - Only write the line number from of the {@link Range.start}.
     * - `"position"` - Only write the line and character of the {@link Range.start}.
     * - `"range"` - Write the line and character of both {@link Range.start} and {@link Range.end}. 
     * - `"position-or-range"` - If the range is empty (i.e., {@link Range.start} and {@link Range.end} are the same), acts like `"position"`; otherwise, acts like `"range"`.
     */
    include?: "line" | "position" | "position-or-range" | "range";

    /**
     * Whether to include the leading `":"` prefix in the result (default `true`).
     */
    prefix?: boolean;

    delimiter?: ":" | ",";
}

/**
 * Formats the provided {@link Range} as a string.
 * @param range The {@link Range} to format.
 */
export function formatRange(range: Range | undefined, { include = "range", prefix = true, delimiter = ":" }: FormatRangeOptions = {}) {
    if (!range) return "";
    let text = "";
    const start = range.start;
    if (!isNaN(start.line)) {
        text += `${prefix ? ":" : ""}${start.line + 1}`;
        if (include === "range" || include === "position-or-range" || include === "position") {
            if (!isNaN(start.character)) {
                text += `${delimiter}${start.character + 1}`;
                const end = range.end;
                if (include === "range" || include === "position-or-range" && !end.isEqual(start)) {
                    if (!isNaN(end.line)) {
                        text += `${delimiter}${end.line + 1}`;
                        if (!isNaN(end.character)) {
                            text += `${delimiter}${end.character + 1}`;
                        }
                    }
                }
            }
        }
    }
    return text;
}

export const RangeEqualer: Equaler<Range> = Equaler.create(
    (x, y) => x.isEqual(y),
    (x) => hashNullable(x.start, PositionEqualer) ^ hashNullable(x.end, PositionEqualer)
);

export const RangeComparer = Comparer.create<Range>(
    (x, y) => x.start.compareTo(y.start) || x.end.compareTo(y.end)
);

export const RangeSerializer = registerKnownSerializer("Range", {
    canSerialize: obj => obj instanceof Range,
    canDeserialize: obj => obj.$type === "Range",
    serialize: (obj, serialize) => ({
        $type: "Range",
        start: PositionSerializer.serialize(obj.start, serialize),
        end: PositionSerializer.serialize(obj.end, serialize)
    }),
    deserialize: (obj, deserialize) => new Range(
        PositionSerializer.deserialize(obj.start, deserialize),
        PositionSerializer.deserialize(obj.end, deserialize)
    ),
    builtin: true
});

declare global { interface KnownSerializers {
    Range: RegisteredSerializer<Range, { $type: "Range", start: KnownSerializedType<"Position">, end: KnownSerializedType<"Position"> }>;
} }
