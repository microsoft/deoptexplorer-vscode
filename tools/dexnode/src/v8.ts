// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import fs from "fs";
import os from "os";
import path from "path";
import semver from "semver";
import { Options } from "./args.js";
import { HostFlags } from "./hostFlags.js";

export type CleanupCallback = () => Promise<void> | void;

type V8Version = 9 | 8;

function prepareDeopts(argv: Options, version: V8Version, flags: string[], cleanupSteps: CleanupCallback[]) {
    if (!argv.deopts) return;
    switch (version) {
        case 9:
            flags.push("--log-deopt");
            break;
        case 8:
            flags.push("--trace-deopt");
            break;
    }

    if (!argv._.includes("--redirect-code-traces")) {
        flags.push("--redirect-code-traces");
        try {
            const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "dexnode-"));
            const asmfile = path.join(tmpdir, "code.asm");
            flags.push(`--redirect-code-traces-to=${asmfile}`);
            cleanupSteps.push(() => fs.promises.rm(tmpdir, { recursive: true, force: true }));
        }
        catch {
        }
    }
}

function prepareICs(argv: Options, version: V8Version, flags: string[]) {
    if (!argv.ics) return;
    switch (version) {
        case 9:
            flags.push("--log-ic");
            break;
        case 8:
            flags.push("--trace-ic");
            break;
    }
}

function prepareMaps(argv: Options, version: V8Version, flags: string[]) {
    if (!argv.maps) return;
    switch (version) {
        case 9:
            flags.push("--log-maps", "--log-maps-details");
            break;
        case 8:
            flags.push("--trace-maps", "--trace-maps-details");
            break;
    }
}

function prepareSources(argv: Options, flags: string[]) {
    if (!argv.sources) return;
    flags.push("--log-code", "--log-source-code");
}

function prepareProfile(argv: Options, flags: string[]) {
    if (!argv.profile) return;
    flags.push("--prof", "--log-internal-timer-events", "--detailed-line-info");
}

function prepareOut(argv: Options, flags: string[]) {
    if (!argv.out) return;
    flags.push(`--logfile=${path.resolve(argv.out)}`);
    if (argv.host.flags & HostFlags.UseNoLogfilePerIsolate) {
        flags.push("--no-logfile-per-isolate");
    }
}

export function prepareV8Flags(argv: Options, v8version: string) {
    const v8 = v8version === "latest" ? "latest" : /^\d+\.\d+\.\d+/i.exec(v8version)?.[0];
    const version =
        v8 === undefined ? 0 :
        v8 === "latest" ? 9 :
        semver.satisfies(v8, ">=9.0.0") ? 9 :
        semver.satisfies(v8, ">=8.0.0") ? 8 :
        0;

    if (version === 0) throw new Error(`Unsupported V8 version: '${v8version}. Please specify a valid version using '--v8-version'.`);

    const flags: string[] = [];
    const cleanup: CleanupCallback[] = [];
    prepareDeopts(argv, version, flags, cleanup);
    prepareICs(argv, version, flags);
    prepareMaps(argv, version, flags);
    prepareSources(argv, flags);
    prepareProfile(argv, flags);
    prepareOut(argv, flags);
    return { flags, cleanup };
}
