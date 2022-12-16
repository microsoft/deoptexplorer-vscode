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

export const formatBytes = new Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "byte",
    unitDisplay: "short",
    useGrouping: true
}).format;

export const formatKilobytes = new Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "kilobyte",
    unitDisplay: "short",
    useGrouping: true,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
}).format;

export const formatMegabytes = new Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "megabyte",
    unitDisplay: "short",
    useGrouping: true,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
}).format;

export const formatMegabytesHighPrecision = new Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "megabyte",
    unitDisplay: "short",
    useGrouping: true,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
}).format;

export const formatGigabytes = new Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "gigabyte",
    unitDisplay: "short",
    useGrouping: true,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
}).format;

export const formatGigabytesHighPrecision = new Intl.NumberFormat("en-US", {
    style: "unit",
    unit: "gigabyte",
    unitDisplay: "short",
    useGrouping: true,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
}).format;

export function formatMemory(size: number) {
    if (size < 1024) return formatBytes(size);
    if (size < 1024 * 1024) return formatKilobytes(size / 1024);
    if (size < 1024 * 1024 * 1024) return formatMegabytes(size / (1024 * 1024));
    return formatGigabytes(size / (1024 * 1024 * 1024));
}

export function formatMemoryHighPrecision(size: number) {
    if (size < 1024) return formatBytes(size);
    if (size < 1024 * 1024) return formatKilobytes(size / 1024);
    if (size < 1024 * 1024 * 1024) return formatMegabytesHighPrecision(size / (1024 * 1024));
    return formatGigabytesHighPrecision(size / (1024 * 1024 * 1024));
}
