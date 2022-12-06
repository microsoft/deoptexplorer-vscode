// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { average, sum } from "@esfx/iter-fn";

/**
 * Computes the standard deviation for a set of numbers.
 * @param array A set of numbers from which to compute the standard deviation
 * @param isTotalPopulation Indicates whether the array represents the total population, or a random sample.
 * If the array is a random sample, [Bessel's Correction](https://en.wikipedia.org/wiki/Bessel%27s_correction) 
 * is applied.
 * @returns The standard deviation *s* if `isTotalPopulation` was `true`, otherwise the standard deviation *σ* is returned.
 */
export function stdDev(array: readonly number[], isTotalPopulation: boolean) {
    if (array.length < 2) return 0;
    const mean = average(array);
    const deviations = array.map(a => (a - mean) ** 2);
    const variance = isTotalPopulation ?
        sum(deviations) / array.length :
        sum(deviations) / (array.length - 1);
    return Math.sqrt(variance);
}

/**
 * Computes a cut-point dividing the range of a probability distribution.
 * 
 * > NOTE: Array must be pre-sorted.
 * @param sorted Pre-sorted array.
 */
export function quantile(sorted: readonly number[], q: number) {
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    return base < sorted.length - 1 ?
        sorted[base] + rest * (sorted[base + 1] - sorted[base]) :
        sorted[base];
}

/**
 * Computes a quartile (4-quantile) dividing the range of a probability distribution into 4 segments.
 * 
 * > NOTE: Array must be pre-sorted.
 * @param sorted Pre-sorted array.
 * @returns A tuple of quantiles in the form `[q1, q2, q3]`, where:
 * - `q1` is the middle number between the smallest number (minimum) and the median of the data set. 25% of the data falls below this point.
 * - `q2` is the median of the data set. 50% of the data falls below this point.
 * - `q3` is the middle number between the median and the largest number (maximum) of the data set. 75% of the data falls below this point.
 */
export function quartiles(sorted: readonly number[]): [q1: number, q2: number, q3: number] {
    return [quantile(sorted, 0.25), quantile(sorted, 0.5), quantile(sorted, 0.75)];
}
