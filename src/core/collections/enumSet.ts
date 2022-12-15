import { Equaler, Equatable } from "@esfx/equatable";
import { identity, intersect, orderBy, union } from "@esfx/iter-fn";

export class ImmutableEnumSet<T extends string | number> {
    static readonly equaler = Equaler.create<ImmutableEnumSet<string | number>>(
        (left, right) => left.equals(right),
        (value) => value.hash()
    );

    private _ordered = false;
    private _set!: Set<T>;

    constructor(values?: Iterable<T>) {
        if (values instanceof ImmutableEnumSet) return values;
        this._set = new Set(values);
    }

    get size() {
        return this._set.size;
    }

    static empty<T extends string | number>() {
        return new ImmutableEnumSet<T>();
    }

    static for<T extends string | number>(values: Iterable<T>) {
        return new ImmutableEnumSet<T>(values);
    }

    has(value: T) {
        return this._set.has(value);
    }

    add(value: T) {
        if (this._set.has(value)) {
            return this;
        }
        const clone = new ImmutableEnumSet<T>(this._set);
        clone._set.add(value);
        return clone;
    }

    delete(value: T) {
        if (!this._set.has(value)) {
            return this;
        }
        const clone = new ImmutableEnumSet(this._set);
        clone._set.delete(value);
        return clone;
    }

    clear() {
        if (this._set.size === 0) {
            return this;
        }

        const clone = new ImmutableEnumSet(this._set);
        clone._set.clear();
        return clone;
    }

    union(other: ImmutableEnumSet<T>): ImmutableEnumSet<T> {
        const result = new ImmutableEnumSet(union(this._set, other._set));
        return result._set.size === this._set.size ? this : result;
    }

    intersect(other: ImmutableEnumSet<T>): ImmutableEnumSet<T> {
        const result = new ImmutableEnumSet(intersect(this._set, other._set));
        return result._set.size === this._set.size ? this : result;
    }

    equals(other: ImmutableEnumSet<T>) {
        if (this === other) {
            return true;
        }
        if (this._set.size !== other._set.size) {
            return false;
        }
        for (const value of this._set) {
            if (!other._set.has(value)) return false;
        }
        return true;
    }

    hash() {
        let hc = 0;
        for (const value of this._set) {
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

    [Symbol.iterator]() {
        return this._getOrderedSet()[Symbol.iterator]() as IterableIterator<T>;
    }

    keys() {
        return this._getOrderedSet().keys() as IterableIterator<T>;
    }

    values() {
        return this._getOrderedSet().values() as IterableIterator<T>;
    }

    entries() {
        return this._getOrderedSet().entries() as IterableIterator<[T, T]>;
    }

    private _getOrderedSet() {
        if (this._ordered || this._set.size <= 1) {
            return this._set;
        }
        this._set = new Set(orderBy(this._set, identity));
        this._ordered = true;
        return this._set;
    }
}