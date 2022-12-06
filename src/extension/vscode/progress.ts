// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Progress } from "vscode";

export function scaleProgress(progress: Progress<number>, scale: number): Progress<number>;
export function scaleProgress(progress: Progress<{ increment?: number, message?: string }>, scale: number): Progress<{ increment?: number, message?: string }>;
export function scaleProgress(progress: Progress<{ increment?: number, message?: string } | number>, scale: number): Progress<{ increment?: number, message?: string } | number> {
    return {
        report(report) {
            if (typeof report === "number") {
                return progress.report(report * scale);
            }
            return progress.report(report.increment !== undefined
                ? { ...report, increment: report.increment * scale }
                : report);
        }
    };
}

export function messageOnlyProgress(progress: Progress<{ increment?: number, message?: string }>): Progress<string> {
    return {
        report(message) {
            return progress.report({ message });
        }
    };
}
