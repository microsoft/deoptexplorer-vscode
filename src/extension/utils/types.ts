// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { types } from "util";

export function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
    return types.isPromise(value);
}

export function isAsyncIterable(value: any): value is AsyncIterable<any> {
    return typeof value === "object" &&
        value != null &&
        Symbol.asyncIterator in value;
}

export function isArray<A extends readonly any[], U>(value: A | U): value is A {
    return Array.isArray(value);
}