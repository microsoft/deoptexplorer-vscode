// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Comparer, Equaler } from "@esfx/equatable";
import { RegisteredSerializer, registerKnownSerializer } from "#core/serializer.js";
import { hashNullable } from "#core/utils.js";
import { Position } from "vscode";

export interface FormatPositionOptions {
    /**
     * Indicates how the position  should be formatted (default `"full"`):
     * 
     * - `"line"` - Only write the line number.
     * - `"full"` - Only write the line and character.
     */
    include?: "line" | "full";

    /**
     * Whether to include the leading `":"` prefix in the result (default `true`).
     */
    prefix?: boolean;
}

/**
 * Formats the provided {@link Position} as a string.
 * @param position The {@link Position} to format.
 */
export function formatPosition(position: Position | undefined, { include = "full", prefix = true }: FormatPositionOptions = {}) {
    if (!position) return "";
    let text = "";
    if (!isNaN(position.line)) {
        text += `${prefix ? ":" : ""}${position.line + 1}`;
        if (include === "full") {
            if (!isNaN(position.character)) {
                text += `:${position.character + 1}`;
            }
        }
    }
    return text;
}


export const PositionEqualer = Equaler.create<Position>(
    (x, y) => x.isEqual(y),
    (x) => hashNullable(x.line) ^ hashNullable(x.character)
);

export const PositionComparer = Comparer.create<Position>(
    (x, y) => x.compareTo(y)
);

export const PositionSerializer = registerKnownSerializer("Position", {
    canSerialize: obj => obj instanceof Position,
    canDeserialize: obj => obj.$type === "Position",
    serialize: obj => ({ $type: "Position", line: obj.line, character: obj.character }),
    deserialize: obj => new Position(obj.line, obj.character),
    builtin: true
});

declare global { interface KnownSerializers {
    Position: RegisteredSerializer<Position, { $type: "Position", line: number, character: number }>;
} }
