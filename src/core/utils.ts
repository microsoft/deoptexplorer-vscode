// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Comparer, Equaler } from "@esfx/equatable";
import { assert } from "./assert";

export function tryExec<T>(cb: () => T, onError?: (e: unknown) => void): T | undefined {
    try {
        return cb();
    }
    catch (e) {
        onError?.(e);
        return undefined;
    }
}

export function binarySearchKey<T, K>(array: readonly T[], key: K, keySelector: (value: T) => K, comparer: Comparer<K>, start = 0, end = array.length): number {
    assert(start >= 0 && start <= array.length);
    assert(end >= 0 && end <= array.length);
    assert(start <= end);
    if (end - start <= 0) return -1;
    let low = start;
    let high = end - 1;
    while (low <= high) {
        const middle = low + ((high - low) >> 1);
        const midKey = keySelector(array[middle]);
        switch (Math.sign(comparer.compare(midKey, key))) {
            case -1:
                low = middle + 1;
                break;
            case 0:
                return middle;
            case +1:
                high = middle - 1;
                break;
        }
    }

    return ~low;
}

const weakNullableEqualers = new WeakMap<Equaler<any>, Equaler<any>>();

export function getNullableEqualer<T>(equaler: Equaler<T>): Equaler<T | null | undefined> {
    let nullableEqualer = weakNullableEqualers.get(equaler);
    if (!nullableEqualer) weakNullableEqualers.set(equaler, nullableEqualer = Equaler.create(
        (left, right) => equateNullable(left, right, equaler),
        (value) => hashNullable(value, equaler)
    ));
    return nullableEqualer;
}

export function equateNullable<T>(a: T | null | undefined, b: T | null | undefined, equaler?: Equaler<T>): boolean {
    return a === b || a !== undefined && a !== null && b !== null && b !== undefined && (equaler ?? Equaler.defaultEqualer).equals(a, b);
}

export function hashNullable<T>(a: T | null | undefined, equaler?: Equaler<T>): number {
    return a === undefined || a === null ? Equaler.defaultEqualer.hash(a) : (equaler || Equaler.defaultEqualer).hash(a);
}

const weakNullableComparers = new WeakMap<Comparer<any>, Comparer<any>>();

export function getNullableComparer<T>(comparer: Comparer<T>): Comparer<T | null | undefined> {
    let nullableComparer = weakNullableComparers.get(comparer);
    if (!nullableComparer) weakNullableComparers.set(comparer, nullableComparer = Comparer.create(
        (left, right) => compareNullable(left, right, comparer),
    ));
    return nullableComparer;
}

export function compareNullable<T>(a: T | null | undefined, b: T | null | undefined, comparer?: Comparer<T>): number {
    return (a ??= null) === (b ??= null) ? 0 : a === null ? -1 : b === null ? +1 : (comparer || Comparer.defaultComparer).compare(a, b);
}
