// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Range, satisfies, SemVer } from "semver";

const emptyArray: readonly string[] = Object.freeze([]);
const maxArray: readonly string[] = Object.freeze([]);
const minArray: readonly string[] = Object.freeze([]);

/**
 * Represents a V8 version number.
 */
export class V8Version {
    private _fullString: string | undefined;
    private _extra: readonly string[];

    constructor(
        readonly semver: Readonly<SemVer>,
        extra: readonly string[] = emptyArray
    ) {
        this._extra = extra;
    }

    static readonly MAX = new V8Version(new SemVer(`${Number.MAX_SAFE_INTEGER}.${Number.MAX_SAFE_INTEGER}.${Number.MAX_SAFE_INTEGER}`, { loose: true }), maxArray);
    static readonly MIN = new V8Version(new SemVer(`0.0.0`, { loose: true }), minArray);

    get extra() {
        return this._extra === maxArray || this._extra === minArray ? emptyArray : this._extra;
    }

    satisfies(range: string | Range) {
        return satisfies(this.semver, range);
    }

    compare(version: string | Readonly<SemVer> | V8Version) {
        let extra: readonly string[] | undefined;
        if (version instanceof V8Version) {
            extra = version._extra;
            version = version.semver;
        }
        else {
            extra = emptyArray;
        }
        const result = this.semver.compare(version);
        if (result) return result;
        if (this._extra === extra) return 0;
        if (this._extra === maxArray) return +1;
        if (this._extra === minArray) return -1;
        if (extra === maxArray) return -1;
        if (extra === minArray) return +1;
        for (let i = 0; i < this._extra.length && i < extra.length; i++) {
            const left = this._extra[i];
            const right = extra[i];
            if (left < right) return -1;
            if (left > right) return +1;
        }
        if (this._extra.length < extra.length) return -1;
        if (this._extra.length > extra.length) return +1;
        return 0;
    }

    toFullString() {
        if (!this._fullString) {
            let s = this.toString();
            if (this._extra === maxArray) {
                s += "+max";
            }
            else if (this._extra === minArray) {
                s += "+min";
            }
            else if (this._extra.length) {
                const components: string[] = [];
                for (const component of this._extra) {
                    components.push(component.startsWith("-") ? component : `.${component}`);
                }
                while (components.length && components[components.length - 1] === ".0") {
                    components.pop();
                }
                s += components.join("");
            }
            this._fullString = s;
        }
        return this._fullString;
    }

    toString() {
        return this.semver.version || this.semver.raw;
    }
}