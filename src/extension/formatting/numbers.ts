// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * formats a number as `1,234.5ms` (no space)
 */
export const formatMilliseconds = new Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "millisecond",
    unitDisplay: "narrow",
    useGrouping: true,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
}).format;

/**
 * formats a number as `1,234.5 ms` (with a space)
 */
export const formatMillisecondsShort = new Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "millisecond",
    unitDisplay: "short",
    useGrouping: true,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
}).format;

/**
 * formats a number as `1,234.567ms` (no space)
 */
export const formatMillisecondsHighPrecision = new Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "millisecond",
    unitDisplay: "narrow",
    useGrouping: true,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
}).format;
