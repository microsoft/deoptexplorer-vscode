// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Disposable, ExtensionContext, OutputChannel, window } from "vscode";
import * as constants from "./constants";
import { formatWithOptions, InspectOptions } from "util";
import { formatMilliseconds } from "./formatting/numbers";
import { Temporal } from "@js-temporal/polyfill";
export * as output from "./outputChannel";

let output: OutputChannel;

const inspectOptions: InspectOptions = {
    colors: false,
}

function timestamp(level: "log" | "warn" | "error") {
    const prefix =
        level === "warn" ? "WRN!" :
        level === "error" ? "ERR!" :
        "INFO";
    const timestamp = Temporal.Now.plainTimeISO();
    return `[${prefix}: ${timestamp.toString({ fractionalSecondDigits: 3 })}] `;
}

function logCore(level: "log" | "warn" | "error", args: any[]) {
    const [format = "", ...rest] = args;
    output.appendLine(`${timestamp(level)}${formatWithOptions(inspectOptions, format, ...rest)}`);
}

export function log(...args: any[]) {
    logCore("log", args);
}

export function warn(...args: any[]) {
    logCore("warn", args);
}

export function error(...args: any[]) {
    logCore("error", args);
}

export function measureSync<T>(name: string, cb: () => T) {
    const start = Date.now();
    const result = cb();
    const end = Date.now();
    log(`${name} took ${formatMilliseconds(end - start)}`);
    return result;
}

export async function measureAsync<T>(name: string, cb: () => PromiseLike<T>) {
    const start = Date.now();
    const result = await cb();
    const end = Date.now();
    log(`${name} took ${formatMilliseconds(end - start)}`);
    return result;
}

export function activateOutputChannel(context: ExtensionContext) {
    return Disposable.from(
        output = window.createOutputChannel(constants.extensionUIName)
    );
}
