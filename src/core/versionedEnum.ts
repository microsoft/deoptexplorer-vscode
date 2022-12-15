// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { V8Version } from "./v8Version";
import { VersionedData } from "./versionedData";

const digitsRegExp = /^\d+$/;

/**
 * An object that presents different evolutions of an enum based on which {@link V8Version} is provided.
 */
 export class VersionedEnum<E extends number> {
    private _name: string;
    private _evolutions: VersionedData<readonly (E | readonly [E, string, ...string[]])[]>;

    /**
     * @param name The name of the enum (for diagnostic messages)
     * @param evolutions The key for each entry should be a valid SemVer Range.
     * The value for each object is a tuple. The ordinal position of each tuple element corresponds to the 
     * numeric value of the enum at the time of the recorded version.
     * Each tuple element is either a numeric value (representing the current value of the enum),
     * or a tuple whose first element is a numeric value, second element is a string name for the value (for use
     * with parsing and formatting), and remaining values are alternative names for the value (for use with parsing).
     */
    constructor(name: string, evolutions: Record<string, readonly (E | readonly [E, string, ...string[]])[]>) {
        this._name = name;
        this._evolutions = new VersionedData(evolutions);
    }

    /**
     * Converts a numeric enum value at the specified version into the current value.
     * @param value The past value of the enum as of the provided version.
     * @param version The version to use when converting the enum value.
     * @throws {TypeError} Argument is not a valid %name%.
     */
    toEnum(value: number, version: V8Version) {
        const enumMappings = this._evolutions.match(version);
        if (enumMappings && value >= 0 && value < enumMappings.length) {
            const result = enumMappings[value];
            return typeof result === "number" ? result : result[0];
        }
        throw new TypeError(`Argument is not a valid ${this._name}: ${value}`);
    }

    /**
     * Parses an enum string based on the specified version, returning the current value of the enum.
     * @param value The past value of the enum as of the provided version.
     * @param version The version to use when parsing the enum value.
     * @param ignoreCase Whether to ignore case when parsing and comparing.
     * @returns The parsed value.
     * @throws {TypeError} Argument is not a valid %name%.
     */
    parseEnum(value: string, version: V8Version, ignoreCase = false) {
        if (digitsRegExp.test(value)) return this.toEnum(parseInt(value, 10), version);
        const enumMappings = this._evolutions.match(version);
        if (enumMappings) {
            const left = ignoreCase ? value.toLowerCase().toUpperCase() : value;
            for (const entry of enumMappings) {
                if (typeof entry === "number") continue;
                const [first, ...rest] = entry;
                for (let i = 0; i < rest.length; i++) {
                    const right = ignoreCase ? rest[i].toLowerCase().toUpperCase() : rest[i];
                    if (left === right) return first;
                }
            }
        }
        throw new TypeError(`Argument is not a valid ${this._name}: ${value}`);
    }

    /**
     * Formats an enum value given the provided version.
     * @param value The current enum version
     * @param version The version to use when parsing the enum value.
     * @returns The formatted value.
     * @throws {TypeError} Argument is not a valid %name%.
     */
    formatEnum(value: E, version: V8Version) {
        const enumMappings = this._evolutions.match(version);
        if (enumMappings) {
            for (const mapping of enumMappings) {
                const mappingValue = typeof mapping === "number" ? mapping : mapping[0];
                if (mappingValue === value) {
                    return typeof mapping === "number" ? `${mapping}` : mapping[1];
                }
            }
        }
        throw new TypeError(`Argument is not a valid ${this._name}: ${value}`);
    }
}
