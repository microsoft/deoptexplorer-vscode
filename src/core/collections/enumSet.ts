// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Equaler, Equatable } from "@esfx/equatable";
import { append, exclude, identity, intersect, orderBy, union } from "@esfx/iter-fn";

/**
 * Represents an immutable set of ordered `enum` values. Mutation-like methods actually produce a new copy of the set.
 */
export class ImmutableEnumSet<T extends string | number> {
    /** An {@link Equaler} used to compare the equality of two {@link ImmutableEnumSet} values. */
    static readonly equaler = Equaler.create<ImmutableEnumSet<string | number>>(this.equals, value => value.hash());

    private static _empty: ImmutableEnumSet<string | number> | undefined;

    /** The underlying set. */
    private _set!: Set<T>;

    /** Indicates whether the set is currently ordered. */
    private _ordered!: boolean;

    constructor(values?: Iterable<T>) {
        if (values instanceof ImmutableEnumSet) {
            return values;
        }

        this._set = new Set(values);
        this._ordered = this._set.size <= 1;
    }

    /**
     * Gets the number of unique elements in the set.
     */
    get size() {
        return this._set.size;
    }

    /**
     * Returns a new empty {@link ImmutableEnumSet}.
     */
    static empty<T extends string | number>() {
        return new ImmutableEnumSet<T>();
    }

    /**
     * Returns a new {@link ImmutableEnumSet} for the provided values.
     */
    static for<T extends string | number>(values: Iterable<T>) {
        return new ImmutableEnumSet<T>(values);
    }

    /**
     * Tests whether the set has the provided value.
     */
    has(value: T) {
        return this._set.has(value);
    }

    /**
     * Produces a new {@link ImmutableEnumSet} containing both the values in this and {@link value}.
     * @returns This set if it already contains value; otherwise, a new {@link ImmutableEnumSet}.
     * @example
     * ```ts
     * const set1 = new ImmutableEnumSet(values);
     * const set2 = set1.add(value);
     * const wasValueAdded = set2 !== set1;
     * ```
     */
    add(value: T) {
        if (this._set.has(value)) {
            return this;
        }

        return new ImmutableEnumSet<T>(append(this._set, value));
    }

    /**
     * Produces a new {@link ImmutableEnumSet} containing the values in this set with the exception of {@link value}.
     * @returns This set if it does not contain {@link value}; otherwise, a new {@link ImmutableEnumSet}.
     */
    delete(value: T) {
        if (!this._set.has(value)) {
            return this;
        }

        return new ImmutableEnumSet(exclude(this._set, value));
    }

    /**
     * Produces a new {@link ImmutableEnumSet} with all of its values removed.
     * @returns This set if it is already empty; otherwise, a new {@link ImmutableEnumSet}.
     */
    clear() {
        if (this._set.size === 0) {
            return this;
        }

        return new ImmutableEnumSet<T>();
    }

    /**
     * Produces a new {@link ImmutableEnumSet} that contains all of the values in both this set and {@link other}.
     * @returns This set if it already contains all of the values in {@link other}; {@link other} if it already contains all of the values in this set; otherwise, a new {@link ImmutableEnumSet}.
     */
    union(other: ImmutableEnumSet<T>): ImmutableEnumSet<T> {
        if (this === other) {
            return this;
        }

        if (other._set.size === 0) {
            return this;
        }

        if (this._set.size === 0) {
            return other;
        }

        const result = new ImmutableEnumSet(union(this._set, other._set));
        return result._set.size === this._set.size ? this :
            result._set.size === other._set.size ? other :
            result;
    }

    /**
     * Produces a new {@link ImmutableEnumSet} that contains only the values that are in both this set and {@link other}.
     * @returns This set if it already contains only the values in {@link other}; {@link other} if it already contains only the values in this set; otherwise, a new {@link ImmutableEnumSet}.
     */
    intersect(other: ImmutableEnumSet<T>): ImmutableEnumSet<T> {
        if (this === other) {
            return this;
        }

        if (this._set.size === 0) {
            return this;
        }

        if (other._set.size === 0) {
            return other;
        }

        const result = new ImmutableEnumSet(intersect(this._set, other._set));
        return result._set.size === this._set.size ? this :
            result._set.size === other._set.size ? other :
            result;
    }

    /**
     * Tests whether the contents of {@link left} and {@link right} are equal.
     */
    static equals<T extends string | number>(left: ImmutableEnumSet<T>, right: ImmutableEnumSet<T>) {
        if (left === right) {
            return true;
        }

        if (left._set.size === 0 && right._set.size === 0) {
            return true;
        }

        if (left._set.size !== right._set.size) {
            return false;
        }

        for (const value of left._set) {
            if (!right._set.has(value)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Tests whether the contents of this set are equal to the contents of {@link other}.
     */
    equals(other: ImmutableEnumSet<T>) {
        return ImmutableEnumSet.equals(this, other);
    }

    /**
     * Gets a hash code for the values contained in this set.
     */
    hash() {
        let hc = 0;
        for (const value of this._getOrderedSet()) {
            hc = Equaler.combineHashes(hc, Equaler.defaultEqualer.hash(value));
        }
        return hc;
    }

    [Equatable.equals](other: unknown): boolean {
        return other instanceof ImmutableEnumSet && this.equals(other);
    }

    [Equatable.hash](): number {
        return this.hash();
    }

    forEach(cb: (value: T, key: T, set: ImmutableEnumSet<T>) => unknown, thisArg?: unknown): void {
        for (const value of this._getOrderedSet()) {
            cb.call(thisArg, value, value, this);
        }
    }

    keys() {
        return this._getOrderedSet().keys();
    }

    values() {
        return this._getOrderedSet().values();
    }

    entries() {
        return this._getOrderedSet().entries();
    }

    [Symbol.iterator]() {
        return this._getOrderedSet().values();
    }

    static {
        ImmutableEnumSet.prototype[Symbol.iterator] = ImmutableEnumSet.prototype.values;
    }

    private _getOrderedSet() {
        if (this._ordered) {
            return this._set;
        }

        this._set = new Set(orderBy(this._set, identity));
        this._ordered = true;
        return this._set;
    }
}
