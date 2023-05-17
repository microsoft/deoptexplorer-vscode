// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import child_process from "child_process";
import semver from "semver";
import path from "path";
import fs from "fs";
import os from "os";

declare global {
    var Deno: { version?: { v8?: string; }; } | undefined;
}

const NULL_DEVICE =
    process.platform === "win32" ? "\\\\.\\NUL" :
    canWriteToDevNull() ? "/dev/null" :
    null;

const argv = parseArgs();
if (argv.help) {
    showHelp();
}
else {
    main().catch(e => {
        console.error(e);
        process.exit(1);
    });
}

function canWriteToDevNull() {
    try {
        if (!fs.existsSync("/dev/null")) return false;
        fs.accessSync("/dev/null", fs.constants.W_OK);
        return true;
    }
    catch {
        return false;
    }
}

function parseArgs() {
    const booleans = new Set(["maps", "ics", "deopts", "profile", "sources", "quiet", "help"]);
    const strings = new Set(["v8_version", "out"]);
    const aliases = { h: "help", "?": "help" };
    const argv: {
        maps?: boolean,
        ics?: boolean,
        deopts?: boolean,
        profile?: boolean,
        sources?: boolean,
        quiet?: boolean,
        help?: boolean,
        v8_version?: string,
        out?: string,
        v8_version?: string,
    } = Object.create(null);
    const args = process.argv.slice(2);
    if (!args.length) {
        argv.help = true;
    }
    while (args.length) {
        let arg = args[0];
        let value: string | boolean = true;

        // stop parsing at --
        if (arg === "--") break;

        if (arg.startsWith("--")) {
            // strip off leading --
            arg = arg.slice(2);
        }
        else if (arg.startsWith("-")) {
            arg = arg.slice(1, 2);
            // stop parsing if arg is not an alias
            if (!(arg in aliases)) break;
            arg = (aliases as any)[arg];
        }
        else {
            // stop parsing if argument is not an option
            break;
        }

        // negate if starts with no-
        if (arg.startsWith("no-")) {
            arg = arg.slice(3);
            value = false;
        }

        // extract argument value
        const eqIndex = arg.indexOf("=");
        if (eqIndex >= 0) {
            value = arg.slice(eqIndex + 1);
            arg = arg.slice(0, eqIndex);
        }

        arg = arg.replace(/-/g, "_");
        if (strings.has(arg)) {
            // stop parsing if argument already encountered
            if (arg in argv) break;

            // stop parsing if string argument was negated
            if (value === false) break;
            if (value === true) {
                // stop parsing if there is no next argument
                if (args.length <= 1) break;
                value = args[1];
                args.shift();
            }
        }
        else if (booleans.has(arg)) {
            // stop parsing if arg had an `=`
            if (typeof value !== "boolean") break;
        }
        else {
            // stop parsing if we don't know the type
            break;
        }

        (argv as any)[arg] = value;
        args.shift();
    }
    return {
        maps: true,
        ics: true,
        deopts: true,
        profile: true,
        sources: true,
        quiet: false,
        help: false,
        ...argv,
        _: args,
    };
}

function prepareV8Flags(v8version: string, v8_flags: string[], cleanupSteps: (() => void | Promise<void>)[]) {
    function prepareDeopts() {
        if (!argv.deopts) return;
        switch (version) {
            case 9:
                v8_flags.push("--log-deopt");
                break;
            case 8:
                v8_flags.push("--trace-deopt");
                break;
        }

        if (!argv._.includes("--redirect-code-traces")) {
            v8_flags.push("--redirect-code-traces");
            if (NULL_DEVICE) {
                v8_flags.push(`--redirect-code-traces-to=${NULL_DEVICE}`);
            }
            else {
                try {
                    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "dexnode-"));
                    const asmfile = path.join(tmpdir, "code.asm");
                    v8_flags.push(`--redirect-code-traces-to=${asmfile}`);
                    cleanupSteps.push(() => fs.promises.rm(tmpdir, { recursive: true, force: true }));
                }
                catch {
                }
            }
        }
    }

    function prepareICs() {
        if (!argv.ics) return;
        switch (version) {
            case 9:
                v8_flags.push("--log-ic");
                break;
            case 8:
                v8_flags.push("--trace-ic");
                break;
        }
    }

    function prepareMaps() {
        if (!argv.maps) return;
        switch (version) {
            case 9:
                v8_flags.push("--log-maps", "--log-maps-details");
                break;
            case 8:
                v8_flags.push("--trace-maps", "--trace-maps-details");
                break;
        }
    }

    function prepareSources() {
        if (!argv.sources)
        v8_flags.push("--log-code", "--log-source-code");
    }

    function prepareProfile() {
        if (!argv.profile) return;
        v8_flags.push("--prof", "--log-internal-timer-events", "--detailed-line-info");
    }

    function prepareOut() {
        if (!argv.out) return;
        v8_flags.push(`--logfile=${argv.out}`, "--no-logfile-per-isolate");
    }

    const v8 = v8version === "latest" ? "latest" : /^\d+\.\d+\.\d+/i.exec(v8version)?.[0];
    const version =
        v8 === undefined ? 0 :
        v8 === "latest" ? 9 :
        semver.satisfies(v8, ">=9.0.0") ? 9 :
        semver.satisfies(v8, ">=8.0.0") ? 8 :
        0;

    if (version === 0) throw new Error(`Unsupported V8 version: '${v8version}`);

    prepareDeopts();
    prepareICs();
    prepareMaps();
    prepareSources();
    prepareProfile();
    prepareOut();
}

function showHelp() {
    const lines = [
        `dexnode [options] [--] <executable> [executable_options]`,
        `options:`,
        `  -h --help                 print this message`,
        `     --no-maps              exclude v8 maps from log`,
        `     --no-ics               exclude ics from log`,
        `     --no-deopts            exclude deopts from log`,
        `     --no-profile           exclude cpu profile from log`,
        `     --no-sources           exclude sources from log`,
        `     --no-quiet             write dexnode messages to stdout (default)`,
        `     --maps                 include v8 maps in log (default)`,
        `     --ics                  include ics in log (default)`,
        `     --deopts               include deopts in log (default)`,
        `     --profile              include cpu profile in log (default)`,
        `     --sources              include sources in log (default)`,
        `     --quiet                do not write dexnode messages to stdout`,
        `     --v8-version VERSION   use arguments specific to the provided V8 version`,
        `     --out FILE             write all log output to FILE (default: isolate-<pid>-<isolate id>-v8.log)`,
        `     --                     pass all remaining arguments to node`,
    ];
    console.log(lines.join("\n"));
}

async function main() {
    const processName = path.basename(process.execPath);
    const isDeno = typeof globalThis.Deno?.version?.v8 === "string";

    const v8_flags: string[] = [];
    const cleanup: (() => Promise<void> | void)[] = [];
    prepareV8Flags(argv.v8_version ?? process.versions.v8 ?? "", v8_flags, cleanup);

    const args: string[] = [];
    if (isDeno) {
        args.push("run", `--v8-flags=${v8_flags.join(",")}`, ...argv._);
    }
    else {
        args.push(...v8_flags, ...argv._);
    }

    if (!argv.quiet) {
        console.log(`> ${processName} ${args.join(" ")}`);
    }

    let result;
    try {
        result = child_process.spawnSync(process.execPath, args, { stdio: "inherit" });
    }
    finally {
        for (const cb of cleanup) {
            try {
                await cb();
            }
            catch (e) {
                console.warn("Error ocurred during cleanup:", e);
            }
        }
    }

    process.exit(result.status ?? undefined);
}