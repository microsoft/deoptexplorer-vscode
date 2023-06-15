// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
//
// THIRD PARTY LICENSE NOTICE:
//
// Portions of this code are sourced from Chromium:
//
//  Copyright (c) 2020 The Chromium Authors. All rights reserved.
//  Use of this source code is governed by a BSD-style license that can be
//  found in the LICENSE.chromium file.

import { sum } from "@esfx/iter-fn";
import { ref, Reference } from "@esfx/ref";
import { html, HtmlString } from "#core/html.js";
import { createHash } from "crypto";

export interface Slice {
    value: number;
    color: string;
    title: string;
    tabIndex?: number;
}

export interface PieOptions {
    size: number;
    cspStyleHashesOut?: string[];
    cutout?: boolean | number | string | Cutout;
    formatter?: (value: number) => string;
    legend?: boolean;
}

export interface Cutout {
    readonly color: string;
    readonly radius: number;
}

function style(s: HtmlString, hashesOut?: string[]) {
    hashesOut?.push(`'sha256-${createHash("sha256").update(s.toString()).digest().toString("base64")}'`);
    return s;
}

export const pieChartStyleResource = "resources/styles/piechart.css";

const defaultCutout: Cutout = { color: "transparent", radius: 0.618 };

/**
 * Generates an SVG pie-chart based on the design in the Chrome DevTools.
 */
export function pieChart(slices: readonly Slice[], options: PieOptions) {
    const cutout: Cutout | undefined = !options.cutout ? undefined :
        typeof options.cutout === "number" ? { ...defaultCutout, radius: Math.max(Math.min(options.cutout, 1), 0) } :
        typeof options.cutout === "string" ? { ...defaultCutout, color: options.cutout } :
        typeof options.cutout === "object" ? { color: options.cutout.color, radius: Math.max(Math.min(options.cutout.radius, 1), 0) } :
        defaultCutout;

    let lastAngle = -Math.PI / 2;
    const ref_lastAngle = ref(() => lastAngle, _ => lastAngle = _);
    const total = sum(slices, e => e.value);

    return html`
    <div class="pie-chart">
        <div class="pie-chart-root" style="${style(html`height: ${options.size}px; width: ${options.size}px;`, options.cspStyleHashesOut)}">
            <svg>
            <g transform="scale(${options.size / 2}) translate(1, 1) scale(0.99, 0.99)">
                <circle r="1" stroke="hsl(0, 0%, 80%)" fill="transparent" stroke-width="${1 / options.size}"></circle>
                ${cutout ?
                    html`<circle r="${cutout.radius}" stroke="hsl(0, 0%, 80%)" fill="${cutout.color}" stroke-width="${1 / options.size}"></circle>` :
                    null}
                ${slices.map(slice => html`
                    <path class="slice" fill="${slice.color}" d="${getPathStringForSlice(total, ref_lastAngle, cutout, slice)}">
                        <title>${slice.title} &mdash; ${options.formatter?.(slice.value) ?? slice.value}</title>
                    </path>
                `)}
            </g>
            </svg>
            ${cutout ? html`
                <div class="pie-chart-foreground">
                    <div class="pie-chart-total">
                        ${options.formatter?.(total) ?? total}
                    </div>
                </div>` :
                null}
        </div>
        ${options.legend ? html`
            <div class="pie-chart-legend">
                ${slices.map(({ color, value, title }) => html`
                    <div class="pie-chart-legend-row">
                        <div class="pie-chart-size">${options.formatter?.(value) ?? value}</div>
                        <div class="pie-chart-swatch" style="${style(html`background-color: ${color}`, options.cspStyleHashesOut)}"></div>
                        <div class="pie-chart-name">${title}</div>
                    </div>
                `)}
                <div class="pie-chart-legend-row">
                    <div class="pie-chart-size">${options.formatter?.(total) ?? total}</div>
                    <div class="pie-chart-swatch pie-chart-empty-swatch"></div>
                    <div class="pie-chart-name">Total</div>
                </div>
            </div>
            ` :
            null}
    </div>
    `;
}

function getPathStringForSlice(total: number, ref_lastAngle: Reference<number>, cutout: Cutout | undefined, slice: Slice) {
    const value = slice.value;
    let sliceAngle = value / total * 2 * Math.PI;
    if (!isFinite(sliceAngle)) {
      return;
    }
    sliceAngle = Math.min(sliceAngle, 2 * Math.PI * 0.9999);
    const x1 = Math.cos(ref_lastAngle.value);
    const y1 = Math.sin(ref_lastAngle.value);
    ref_lastAngle.value += sliceAngle;
    const x2 = Math.cos(ref_lastAngle.value);
    const y2 = Math.sin(ref_lastAngle.value);
    const r2 = cutout ? cutout.radius : 0;
    const x3 = x2 * r2;
    const y3 = y2 * r2;
    const x4 = x1 * r2;
    const y4 = y1 * r2;
    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A 1 1 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${r2} ${r2} 0 ${largeArc} 0 ${x4} ${y4} Z`;
}
