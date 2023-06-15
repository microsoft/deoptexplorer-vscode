// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Comparable, Comparer, Equaler, Equatable } from "@esfx/equatable";
import { ref } from "@esfx/ref";
import { KnownSerializedType, RegisteredSerializer, registerKnownSerializer } from "#core/serializer.js";
import { resolveUri, uriBasename } from "#core/uri.js";
import { compareNullable, equateNullable, hashNullable } from "#core/utils.js";
import { FunctionState, parseFunctionState } from "#v8/enums/functionState.js";
import { CodeEntry } from "#v8/tools/codeentry.js";
import * as path from "path";
import { Location, Position, Range, Uri } from "vscode";
import { getCanonicalUri } from "../services/canonicalPaths";
import { LocationComparer, LocationEqualer, LocationSerializer } from "../vscode/location";
import { tryParseTrailingRange } from "../vscode/range";
import { isPathOrUriString, pathOrUriStringToUri } from "../vscode/uri";

const functionFileRegExp = /^(?:(?<type>\w+): (?<state>[~*])?)?(?<nameAndLocation>.*)$/;
const uriOrPathStartRegExp = /(?:[\\/](?:[a-z](?:[:|]|%3a|%7c)[\\/]?)|[a-z](?:[:|]|%3a|%7c)[\\/]?)|[a-z][-+.a-z0-9]*:/iy;
const cppFunctionNameRegExp = /^\w+::/y;

export class FunctionName {
    constructor(
        readonly name: string,
        readonly filePosition: Location | undefined,
        readonly type?: string,
        readonly state?: FunctionState
    ) {
    }

    static fromCodeEntry(entry: CodeEntry) {
        const name = entry.getRawName();
        return FunctionName.parse(name);
    }

    static parse(text: string) {
        switch (text) {
            case "(root)":
            case "(gc)":
            case "(idle)":
            case "(program)":
            case "(unresolved function)":
            case "(hidden)":
                return new FunctionName(text, /*location*/ undefined);
        }
        const match = functionFileRegExp.exec(text);
        if (match?.groups) {
            const { type, state } = match.groups;
            const out_prefixLength = ref.out<number>();
            let nameAndLocation = match.groups.nameAndLocation;

            // nameAndLocation can be one of several things based on
            // which call to Logger::CodeCreateEvent was used:
            // - `<name>`
            // - `<script_name>`
            // - `<debug_name> <script_name>:<line>:<column>`

            let range = tryParseTrailingRange(nameAndLocation, out_prefixLength);
            if (range) {
                nameAndLocation = nameAndLocation.slice(0, out_prefixLength.value);
            }

            let name: string | undefined;
            let pathname: string | undefined;
            for (let i = nameAndLocation.lastIndexOf(" "); i >= 0; i = i === 0 ? -1 : nameAndLocation.lastIndexOf(" ", i - 1)) {
                cppFunctionNameRegExp.lastIndex = i + 1;
                if (cppFunctionNameRegExp.test(nameAndLocation)) {
                    continue;
                }

                uriOrPathStartRegExp.lastIndex = i + 1;
                if (uriOrPathStartRegExp.test(nameAndLocation)) {
                    pathname = nameAndLocation.slice(i + 1);
                    name = nameAndLocation.slice(0, i);
                    break;
                }
            }

            if (name === undefined) {
                const lastSpace = nameAndLocation.lastIndexOf(" ");
                if (lastSpace >= 0) {
                    pathname = nameAndLocation.slice(lastSpace + 1);
                    name = nameAndLocation.slice(0, lastSpace);
                }
            }

            if (name === undefined) {
                cppFunctionNameRegExp.lastIndex = 0;
                if (cppFunctionNameRegExp.test(nameAndLocation)) {
                    name = nameAndLocation;
                }
                else {
                    uriOrPathStartRegExp.lastIndex = 0;
                    if (uriOrPathStartRegExp.test(nameAndLocation)) {
                        pathname = nameAndLocation;
                        name = path.basename(pathname);
                    }
                    else {
                        name = nameAndLocation.trim();
                    }
                }
            }

            let location: Location | undefined;
            if (range || pathname) {
                range ??= new Range(new Position(0, 0), new Position(0, 0));
                const uri = !pathname ? Uri.parse("missing:", /*strict*/ true) :
                    isPathOrUriString(pathname) ? pathOrUriStringToUri(pathname) :
                    resolveUri(Uri.parse("unknown:", /*strict*/ true), pathname);
                location = new Location(getCanonicalUri(uri), range);
            }

            return new FunctionName(name, location, type, state ? parseFunctionState(state) : undefined);
        }

        const out_prefixLength = ref.out<number>();
        const range = tryParseTrailingRange(text, out_prefixLength);
        if (range) {
            const uriString = text.slice(0, out_prefixLength.value);
            const uri = getCanonicalUri(pathOrUriStringToUri(uriString));
            return new FunctionName(uriBasename(uri), new Location(uri, range), /*type*/ undefined, /*state*/ undefined);
        }
        return new FunctionName(text, /*filePosition*/ undefined, /*type*/ undefined, /*state*/ undefined);
    }

    compareTo(other: FunctionName) {
        return FunctionNameComparer.compare(this, other);
    }

    equals(other: FunctionName) {
        return FunctionNameEqualer.equals(this, other);
    }

    hash() {
        return FunctionNameEqualer.hash(this);
    }

    toString() {
        let s = this.name;
        if (this.type) {
            const state =
                this.state === FunctionState.Interpreted ? "~" :
                this.state === FunctionState.Optimized ? "*" :
                this.state === FunctionState.CompiledSparkplug ? "^" :
                this.state === FunctionState.OptimizedMaglev ? "+" :
                "";
            s = `${this.type}: ${state}${s}`;
        }
        if (this.filePosition) {
            s = `${s} ${this.filePosition}`;
        }
        return s;
    }

    [Equatable.equals](other: unknown) { return other instanceof FunctionName && this.equals(other); }
    [Equatable.hash]() { return this.hash(); }
    [Comparable.compareTo](other: unknown) { return other instanceof FunctionName ? this.compareTo(other) : 0; }
}

export const FunctionNameEqualer = Equaler.create<FunctionName>(
    (x, y) => equateNullable(x.filePosition, y.filePosition, LocationEqualer) && equateNullable(x.name, y.name),
    (x) => hashNullable(x.filePosition, LocationEqualer) ^ hashNullable(x.name),
);

export const FunctionNameComparer = Comparer.create<FunctionName>(
    (x, y) => compareNullable(x.filePosition, y.filePosition, LocationComparer) || compareNullable(x.name, y.name)
);

export const FunctionNameSerializer = registerKnownSerializer("FunctionName", {
    canSerialize: obj => obj instanceof FunctionName,
    canDeserialize: obj => obj.$type === "FunctionName",
    serialize: (obj, serialize) => ({
        $type: "FunctionName",
        name: obj.name,
        filePosition: obj.filePosition && LocationSerializer.serialize(obj.filePosition, serialize)
    }),
    deserialize: (obj, deserialize) => new FunctionName(
        obj.name,
        obj.filePosition && LocationSerializer.deserialize(obj.filePosition, deserialize)
    ),
});

declare global { interface KnownSerializers {
    FunctionName: RegisteredSerializer<FunctionName, { $type: "FunctionName", name: string, filePosition: KnownSerializedType<"Location"> | undefined }>;
} }
