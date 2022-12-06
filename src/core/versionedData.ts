// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as semver from "semver";
import { V8Version } from "./v8Version";

/**
 * An object that presents different evolutions of data based on which {@link V8Version} is provided.
 */
export class VersionedData<T> {
    private _evolutions: [semver.Range, T][] = [];
    private _defaultEvolution: T | undefined;
    private _versionCache: [V8Version, T | undefined] | undefined;

    /**
     * @param evolutions An object where each key matches a semver range.
     */
    constructor(evolutions: Record<string, T>) {
        for (const key of Object.keys(evolutions)) {
            const mappings = evolutions[key];
            if (key === "*" || key === "") {
                this._defaultEvolution = mappings;
            }
            else {
                const range = new semver.Range(key, { loose: true });
                this._evolutions.push([range, mappings]);
            }
        }
    }

    /**
     * Gets the evolution for the most recent {@link V8Version}
     */
    latest() {
        return this.match(V8Version.MAX);
    }

    /**
     * Gets the evolution for the most earliest {@link V8Version}
     */
     earliest() {
        return this.match(V8Version.MIN);
    }

    /**
     * Gets the evolution that matches the provided version.
     */
    match(version: V8Version | semver.SemVer | string) {
        let data: T | undefined;
        if (typeof version === "string") {
            version = new semver.SemVer(version, { loose: true });
        }
        if (version instanceof semver.SemVer) {
            version = new V8Version(version, []);
        }
        if (this._versionCache?.[0].compare(version) === 0) {
            data = this._versionCache[1];
        }
        else {
            data = this._defaultEvolution;
            for (const [range, mappings] of this._evolutions) {
                if (version.satisfies(range)) {
                    data = mappings;
                    break;
                }
            }
            this._versionCache = [version, data];
        }
        return data;
    }
}
