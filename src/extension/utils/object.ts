// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export function typeSafeKeys<T extends object>(o: T) {
    return Object.keys(o) as Extract<keyof T, string>[];
}

export function typeSafeValues<T extends object>(o: T) {
    return Object.values(o) as T[Extract<keyof T, string>][];
}

export type TypeSafeEntries<T extends object> = Extract<{ [P in Extract<keyof T, string>]: [P, T[P]] }[Extract<keyof T, string>], [string, any]>[];

export function typeSafeEntries<T extends object>(o: T) {
    return Object.entries(o) as TypeSafeEntries<T>;
}

export type TypeSafeDefinedEntries<T extends object> = Extract<{ [P in Extract<keyof T, string>]-?: [P, Exclude<T[P], undefined>] }[Extract<keyof T, string>], [string, any]>[];

export function typeSafeDefinedEntries<T extends object>(o: T) {
    return Object.entries(o).filter(o => o[1] !== undefined) as TypeSafeDefinedEntries<T>;
}
