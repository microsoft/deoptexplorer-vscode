// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export function fail(message: string | Error): never {
    if (typeof message === "string") {
        message = new Error(message);
        Error.captureStackTrace?.(message, fail);
    }
    throw message;
}

export function assert(condition: false, message?: string): never;
export function assert(condition: any, message?: string): asserts condition;
export function assert(condition: any, message?: string): asserts condition {
    if (!condition) {
        debugger;
        fail(message || "Condition not met");
    }
}

export function assertNever(value: never): never {
    fail(`Expected ${value} to be unreachable`);
}