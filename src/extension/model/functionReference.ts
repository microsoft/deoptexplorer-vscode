// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Comparable, Comparer, Equaler, Equatable } from "@esfx/equatable";
import { compare, equate, hash } from "@esfx/fn";
import { KnownSerializedType, RegisteredSerializer, registerKnownSerializer } from "#core/serializer.js";
import { UriComparer, UriEqualer, UriSerializer } from "#core/uri.js";
import { compareNullable, equateNullable, hashNullable } from "#core/utils.js";
import { FunctionEntry } from "#deoptigate/functionEntry.js";
import { Location, Range, SymbolKind, Uri } from "vscode";
import { RangeComparer, RangeEqualer, RangeSerializer } from "../vscode/range";

export class FunctionReference implements Equatable, Comparable {
    static readonly equaler = Equaler.create<FunctionReference>(
        (left, right) =>
            equateNullable(left.uri, right.uri, UriEqualer) &&
            equateNullable(left.range, right.range, RangeEqualer) &&
            equate(left.name, right.name) &&
            equateNullable(left.symbolKind,right.symbolKind),
        (value) => {
            let hc = 0;
            hc = Equaler.combineHashes(hc, hashNullable(value.uri, UriEqualer));
            hc = Equaler.combineHashes(hc, hashNullable(value.range, RangeEqualer));
            hc = Equaler.combineHashes(hc, hash(value.name));
            hc = Equaler.combineHashes(hc, hashNullable(value.symbolKind));
            return hc;
        },
    );

    static readonly comparer = Comparer.create<FunctionReference>(
        (left, right) =>
            compareNullable(left.uri, right.uri, UriComparer) ||
            compareNullable(left.range, right.range, RangeComparer) ||
            compare(left.name, right.name) ||
            compareNullable(left.symbolKind, right.symbolKind),
    );

    static readonly serializer = registerKnownSerializer("FunctionReference", {
        canSerialize: obj => obj instanceof FunctionReference,
        canDeserialize: obj => obj.$type === "FunctionReference",
        serialize: (obj, serialize) => ({
            $type: "FunctionReference",
            name: obj.name,
            uri: obj.uri && UriSerializer.serialize(obj.uri, serialize),
            range: obj.range && RangeSerializer.serialize(obj.range, serialize),
            symbolKind: obj.symbolKind,
        }),
        deserialize: (obj, deserialize) => new FunctionReference(
            obj.name,
            obj.uri && UriSerializer.deserialize(obj.uri, deserialize),
            obj.range && RangeSerializer.deserialize(obj.range, deserialize),
            obj.symbolKind,
        ),
    });

    private _location: Location | undefined;

    constructor(
        readonly name: string,
        readonly uri: Uri | undefined,
        readonly range: Range | undefined,
        readonly symbolKind: SymbolKind | undefined,
    ) {
    }

    get location() {
        if (this._location === undefined && this.uri && this.range) {
            this._location = new Location(this.uri, this.range);
        }
        return this._location;
    }

    static fromFunctionEntry(entry: FunctionEntry) {
        return new FunctionReference(
            entry.functionName,
            entry.filePosition.uri,
            entry.filePosition.range,
            entry.symbolKind,
        );
    }

    equals(other: FunctionReference) {
        return FunctionReference.equaler.equals(this, other);
    }

    hash() {
        return FunctionReference.equaler.hash(this);
    }

    compareTo(other: FunctionReference) {
        return FunctionReference.comparer.compare(this, other);
    }

    [Equatable.equals](other: unknown) {
        return other instanceof FunctionReference &&
            FunctionReference.equaler.equals(this, other);
    }

    [Equatable.hash]() {
        return FunctionReference.equaler.hash(this)
    }

    [Comparable.compareTo](other: unknown) {
        return other instanceof FunctionReference ? FunctionReference.comparer.compare(this, other) : 0;
    }
}

declare global {
    interface KnownSerializers {
        FunctionReference: RegisteredSerializer<FunctionReference, {
            $type: "FunctionReference";
            name: string;
            uri: KnownSerializedType<"Uri"> | undefined;
            range: KnownSerializedType<"Range"> | undefined;
            symbolKind: SymbolKind | undefined;
        }>;
    }
}
