// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * A color scale for graphical items
 */
export const colors = [
    "#5899DA", // neutral (light blue)
    "#E8743B", // neutral (orange)
    "#19A979", // neutral (green)
    "#ED4A7B", // neutral (pink)
    "#945ECF", // neutral (purple)
    "#13A4B4", // neutral (cyan)
    "#525DF4", // neutral (dark blue)
    "#BF399E", // neutral (dark pink)
    "#6C8893", // neutral (gray)
    "#EE6868", // neutral (salmon)
    "#2F6497", // neutral (slate blue)
    "#5899DACC",
    "#E8743BCC",
    "#19A979CC",
    "#ED4A7BCC",
    "#945ECFCC",
    "#13A4B4CC",
    "#525DF4CC",
    "#BF399ECC",
    "#6C8893CC",
    "#EE6868CC",
    "#2F6497CC",
    "#5899DA99",
    "#E8743B99",
    "#19A97999",
    "#ED4A7B99",
    "#945ECF99",
    "#13A4B499",
    "#525DF499",
    "#BF399E99",
    "#6C889399",
    "#EE686899",
    "#2F649799",
    "#5899DA66",
    "#E8743B66",
    "#19A97966",
    "#ED4A7B66",
    "#945ECF66",
    "#13A4B466",
    "#525DF466",
    "#BF399E66",
    "#6C889366",
    "#EE686866",
    "#2F649766",
] as const;

export function getColor(colorIndex: number) {
    return colors[colorIndex % colors.length];
}