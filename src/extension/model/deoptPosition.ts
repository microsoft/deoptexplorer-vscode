// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "#core/assert.js";
import { Location } from "vscode";
import { getCanonicalLocation } from "../services/canonicalPaths";
import { formatLocation, parseLocation } from "../vscode/location";

const deoptPositionRegExp = /^<(.+?)>((?: inlined at <[^>]+>)*)$/;
const inlinedAtRegExp = /^ inlined at <([^>]+)>/;

/**
 * Represents a position at which a deoptimization occurs, along with any relevant inlining locations.
 */
export class DeoptPosition {
    constructor(
        public filePosition: Location,
        public inlinedAt?: readonly Location[]) {
    }

    /**
     * Parses a deopt position from a V8 log.
     */
    static parse(text: string) {
        let match = deoptPositionRegExp.exec(text);
        if (match) {
            const filePosition = getCanonicalLocation(parseLocation(match[1], /*strict*/ false));
            let inlinedAt: Location[] | undefined;
            let rest = match[2];
            while (rest) {
                assert(match = inlinedAtRegExp.exec(rest));
                inlinedAt ??= [];
                inlinedAt.push(getCanonicalLocation(parseLocation(match[1], /*strict*/ false)));
                rest = rest.slice(match[0].length);
            }
            return new DeoptPosition(filePosition, inlinedAt);
        }
        return new DeoptPosition(getCanonicalLocation(parseLocation(text, /*strict*/ false)));
    }

    toString() {
        let text = `<${this.filePosition}>`;
        if (this.inlinedAt) {
            for (const location of this.inlinedAt) {
                text += ` inlined at <${formatLocation(location, { as: "file", include: "position" })}>`;
            }
        }
        return text;
    }
}
