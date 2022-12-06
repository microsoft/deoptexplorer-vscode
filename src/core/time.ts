// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Comparer, Equaler, Equatable } from "@esfx/equatable";
import { Decimal } from "decimal.js-light";
import { Comparable } from "@esfx/equatable";
import { assertNever } from "./assert";

const ZERO = BigInt(0) as 0n;
const ONE = BigInt(1) as 1n;
const MICROSECONDS_PER_NANOSECOND = BigInt(1_000) as 1_000n;
const MILLISECONDS_PER_NANOSECOND = BigInt(1_000_000) as 1_000_000n;
const SECONDS_PER_NANOSECOND = BigInt(1_000_000_000) as 1_000_000_000n;
const MINUTES_PER_NANOSECOND = BigInt(60_000_000_000) as 60_000_000_000n;
const HOURS_PER_NANOSECOND = BigInt(360_000_000_000) as 360_000_000_000n;
const DAYS_PER_NANOSECOND = BigInt(8_640_000_000_000) as 8_640_000_000_000n;

type Scale =
    | "nanoseconds"
    | "microseconds"
    | "milliseconds"
    | "seconds"
    | "minutes"
    | "hours"
    | "days"
    ;

function getNanosecondScale(scale: Scale) {
    switch (scale) {
        case "nanoseconds": return ONE;
        case "microseconds": return MICROSECONDS_PER_NANOSECOND;
        case "milliseconds": return MILLISECONDS_PER_NANOSECOND;
        case "seconds": return SECONDS_PER_NANOSECOND;
        case "minutes": return MINUTES_PER_NANOSECOND;
        case "hours": return HOURS_PER_NANOSECOND;
        case "days": return DAYS_PER_NANOSECOND;
        default: assertNever(scale);
    }
}

function getNanosecondsFromDecimal(value: Decimal, scale: Scale): bigint {
    const negative = value.isNegative();
    const abs = value.abs();
    const whole = abs.toDecimalPlaces(0, Decimal.ROUND_FLOOR);
    let nanoseconds = BigInt(whole.toString()) * getNanosecondScale(scale);
    if (scale !== "nanoseconds") {
        const fraction = abs.minus(whole);
        if (!fraction.isZero()) {
            const newScale =
                scale === "days" ? "hours" :
                scale === "hours" ? "minutes" :
                scale === "minutes" ? "seconds" :
                scale === "seconds" ? "milliseconds" :
                scale === "milliseconds" ? "microseconds" :
                scale === "microseconds" ? "nanoseconds" :
                assertNever(scale);
            const operand =
                scale === "days" ? 24 :
                scale === "hours" ? 60 :
                scale === "minutes" ? 60 :
                scale === "seconds" ? 1000 :
                scale === "milliseconds" ? 1000 :
                scale === "microseconds" ? 1000 :
                assertNever(scale);
            nanoseconds += getNanosecondsFromDecimal(fraction.times(operand), newScale);
        }
    }
    return negative ? -nanoseconds : nanoseconds;
}

function getNanosecondsFromFloat(value: number, scale: Scale) {
    if (!isFinite(value)) throw new TypeError("Expected a finite number value");
    return getNanosecondsFromDecimal(new Decimal(value), scale);
}

function getNanoseconds(value: string | number | bigint, scale: Scale) {
    return typeof value === "bigint" ? value * getNanosecondScale(scale) :
        typeof value === "number" ? getNanosecondsFromFloat(value, scale) :
        typeof value === "string" ? getNanosecondsFromDecimal(new Decimal(value), scale) :
        assertNever(value);
}

function getNumber(value: bigint, scale: bigint) {
    const negative = value < ZERO;
    const abs = negative ? -value : value;
    const whole = Number(abs / scale);
    const fraction = Number(abs % scale) / Number(scale);
    const num = whole + fraction;
    return negative ? -num : num;
}

export class TimeTicks {
    static readonly Zero = new TimeTicks(ZERO);

    private _nanoseconds: bigint;

    private constructor(nanoseconds: bigint) {
        this._nanoseconds = nanoseconds;
    }

    static sinceOrigin(delta: TimeDelta) {
        return new TimeTicks(delta.inNanoseconds());
    }

    sinceOrigin() {
        return TimeDelta.fromNanoseconds(this._nanoseconds);
    }

    equals(other: TimeTicks) {
        return Equaler.defaultEqualer.equals(this._nanoseconds, other._nanoseconds);
    }

    hash() {
        return Equaler.defaultEqualer.hash(this._nanoseconds);
    }

    compareTo(other: TimeTicks) {
        return Comparer.defaultComparer.compare(this._nanoseconds, other._nanoseconds);
    }

    toString(radix?: number) {
        return this._nanoseconds.toString(radix);
    }

    valueOf() {
        return this._nanoseconds;
    }

    add(delta: TimeDelta) {
        return new TimeTicks(this._nanoseconds + delta.inNanoseconds());
    }

    subtract(delta: TimeTicks): TimeDelta;
    subtract(delta: TimeDelta): TimeTicks;
    subtract(delta: TimeDelta | TimeTicks) {
        if (delta instanceof TimeDelta) {
            return new TimeTicks(this._nanoseconds - delta.inNanoseconds());
        }
        return TimeDelta.fromNanoseconds(this._nanoseconds - delta._nanoseconds);
    }

    [Equatable.equals](other: unknown) {
        return other instanceof TimeTicks && this.equals(other);
    }

    [Equatable.hash]() {
        return this.hash();
    }

    [Comparable.compareTo](other: unknown) {
        return other instanceof TimeTicks ? this.compareTo(other) : 0;
    }
}

export const TimeTicksEqualer = Equaler.create<TimeTicks>(
    (x, y) => x.equals(y),
    (x) => x.hash()
);

export const TimeTicksComparer = Comparer.create<TimeTicks>(
    (x, y) => x.compareTo(y)
);

export class TimeDelta {
    static readonly Zero = new TimeDelta(ZERO);

    private _delta: bigint;

    private constructor(delta: bigint) {
        this._delta = delta;
    }

    static fromNanoseconds(nanoseconds: number | bigint | string) {
        return new TimeDelta(getNanoseconds(nanoseconds, "nanoseconds"));
    }

    static fromMicroseconds(microseconds: number | bigint | string) {
        return new TimeDelta(getNanoseconds(microseconds, "microseconds"));
    }

    static fromMilliseconds(milliseconds: number | bigint | string) {
        return new TimeDelta(getNanoseconds(milliseconds, "milliseconds"));
    }

    static fromSeconds(seconds: number | bigint | string) {
        return new TimeDelta(getNanoseconds(seconds, "seconds"));
    }

    static fromMinutes(minutes: number | bigint | string) {
        return new TimeDelta(getNanoseconds(minutes, "minutes"));
    }

    static fromHours(hours: number | bigint | string) {
        return new TimeDelta(getNanoseconds(hours, "hours"));
    }

    static fromDays(days: number | bigint | string) {
        return new TimeDelta(getNanoseconds(days, "days"));
    }

    /**
     * Gets the time delta expressed in whole nanoseconds.
     */
    inNanoseconds() {
        return this._delta;
    }

    /**
     * Gets the time delta expressed in nanoseconds as a `Number` (throws if the delta is outside the range of `(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)`).
     */
    inNanosecondsF() {
        if (this._delta < BigInt(Number.MIN_SAFE_INTEGER) || this._delta > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError();
        return Number(this._delta);
    }

    /**
     * Gets the time delta expressed in whole microseconds (rounded down).
     */
    inMicroseconds() {
        return this._delta / MICROSECONDS_PER_NANOSECOND;
    }

    /**
     * Gets the time delta expressed in whole microseconds (rounded up).
     */
    inMicrosecondsRoundedUp() {
        const negative = this._delta < ZERO;
        const abs = negative ? -this._delta : this._delta;
        const whole = Number(abs / MICROSECONDS_PER_NANOSECOND);
        const rem = Number(abs % MICROSECONDS_PER_NANOSECOND);
        const ms = negative ? -whole : whole;
        return rem ? ms + 1 : ms;
    }

    /**
     * Gets the time delta expressed in fractional microseconds.
     */
    inMicrosecondsF() {
        return getNumber(this._delta, MICROSECONDS_PER_NANOSECOND);
    }

    /**
     * Gets the time delta expressed in whole milliseconds (rounded down).
     */
    inMilliseconds() {
        return Number(this._delta / MILLISECONDS_PER_NANOSECOND);
    }

    /**
     * Gets the time delta expressed in whole milliseconds (rounded up).
     */
    inMillisecondsRoundedUp() {
        const negative = this._delta < ZERO;
        const abs = negative ? -this._delta : this._delta;
        const whole = Number(abs / MILLISECONDS_PER_NANOSECOND);
        const rem = Number(abs % MILLISECONDS_PER_NANOSECOND);
        const ms = negative ? -whole : whole;
        return rem ? ms + 1 : ms;
    }

    /**
     * Gets the time delta expressed in fractional milliseconds.
     * */
    inMillisecondsF() {
        return getNumber(this._delta, MILLISECONDS_PER_NANOSECOND);
    }

    /**
     * Gets the time delta expressed in whole seconds (rounded down).
     */
    inSeconds() {
        return Number(this._delta / SECONDS_PER_NANOSECOND);
    }

    /**
     * Gets the time delta expressed in fractional seconds.
     */
    inSecondsF() {
        return getNumber(this._delta, SECONDS_PER_NANOSECOND);
    }

    /** Gets the time delta expressed in whole minutes (rounded down). */
    inMinutes() {
        return Number(this._delta / MINUTES_PER_NANOSECOND);
    }

    /**
     * Gets the time delta expressed in fractional minutes.
     */
    inMinutesF() {
        return getNumber(this._delta, MINUTES_PER_NANOSECOND);
    }

    /**
     * Gets the time delta expressed in whole hours (rounded down).
     */
    inHours() {
        return Number(this._delta / HOURS_PER_NANOSECOND);
    }

    /**
     * Gets the time delta expressed in fractional hours.
     */
    inHoursF() {
        return getNumber(this._delta, HOURS_PER_NANOSECOND);
    }

    /**
     * Gets the time delta expressed in whole days (rounded down).
     */
    inDays() {
        return Number(this._delta / DAYS_PER_NANOSECOND);
    }

    /**
     * Gets the time delta expressed in fractional days.
     */
    inDaysF() {
        return getNumber(this._delta, DAYS_PER_NANOSECOND);
    }

    add(other: TimeTicks): TimeTicks;
    add(other: TimeDelta): TimeDelta;
    add(other: TimeDelta | TimeTicks) {
        if (other instanceof TimeDelta) {
            return new TimeDelta(this._delta + other._delta);
        }
        return TimeTicks.sinceOrigin(other.sinceOrigin().add(this));
    }

    subtract(other: TimeDelta) {
        return new TimeDelta(this._delta - other._delta);
    }

    multiply(value: bigint | number) {
        return new TimeDelta(this._delta * BigInt(value));
    }

    divide(value: bigint | number) {
        if (BigInt(value) === BigInt(0)) return new TimeDelta(BigInt(0));
        return new TimeDelta(this._delta / BigInt(value));
    }

    sign() {
        return this._delta < 0 ? -1 : this._delta > 0 ? +1 : 0;
    }

    abs() {
        return this._delta < 0 ? this.negate() : this;
    }

    negate() {
        return new TimeDelta(-this._delta);
    }

    equals(other: TimeDelta) {
        return Equaler.defaultEqualer.equals(this._delta, other._delta);
    }

    hash() {
        return Equaler.defaultEqualer.hash(this._delta);
    }

    compareTo(other: TimeDelta) {
        return Comparer.defaultComparer.compare(this._delta, other._delta);
    }

    toString(radix?: number) {
        return this._delta.toString(radix);
    }

    valueOf() {
        return this._delta;
    }

    [Equatable.equals](other: unknown) {
        return other instanceof TimeDelta && this.equals(other);
    }

    [Equatable.hash]() {
        return this.hash();
    }

    [Comparable.compareTo](other: unknown) {
        return other instanceof TimeDelta ? this.compareTo(other) : 0;
    }
}

export const TimeDeltaEqualer = Equaler.create<TimeDelta>(
    (x, y) => x.equals(y),
    (x) => x.hash()
);

export const TimeDeltaComparer = Comparer.create<TimeDelta>(
    (x, y) => x.compareTo(y)
);
