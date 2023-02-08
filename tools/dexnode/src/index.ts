// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import child_process from "child_process";
import semver from "semver";

const NULL_DEVICE = process.platform === "win32" ? "\\\\.\\NUL" : "/dev/null";
const argv = parseArgs();
if (argv.help) {
    showHelp();
}
else {
    main();
}

function parseArgs() {
    const booleans = new Set(["maps", "ics", "deopts", "profile", "sources", "quiet", "help"]);
    const strings = new Set(["out"]);
    const aliases = { h: "help", "?": "help" };
    const argv: {
        maps?: boolean,
        ics?: boolean,
        deopts?: boolean,
        profile?: boolean,
        sources?: boolean,
        quiet?: boolean,
        help?: boolean,
        out?: string,
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

function redirectCodeTraces() {
    return argv._.includes("--redirect-code-traces") ? [] : ["--redirect-code-traces", `--redirect-code-traces-to=${NULL_DEVICE}`];
}

function getV8Flags() {
    const v8 = /^\d+\.\d+\.\d+/.exec(process.versions.v8)?.[0];
    if (!v8) throw new Error(`Unrecognized V8 version: '${process.versions.v8}'`);
    if (semver.satisfies(v8, ">=9.0.0")) return [
        ...argv.deopts ? ["--log-deopt", ...redirectCodeTraces()] : [],
        ...argv.ics ? ["--log-ic"] : [],
        ...argv.maps ? ["--log-maps", "--log-maps-details"] : [],
        ...argv.sources ? ["--log-code", "--log-source-code"] : [],
        ...argv.profile ? ["--prof", "--log-internal-timer-events", "--detailed-line-info"] : [],
        ...argv.out ? [`--logfile=${argv.out}`, "--no-logfile-per-isolate"] : [],
    ];
    if (semver.satisfies(v8, ">=8.0.0")) return [
        ...argv.deopts ? ["--trace-deopt", ...redirectCodeTraces()] : [],
        ...argv.ics ? ["--trace-ic"] : [],
        ...argv.maps ? ["--trace-maps", "--trace-maps-details"] : [],
        ...argv.sources ? ["--log-code", "--log-source-code"] : [],
        ...argv.profile ? ["--prof", "--log-internal-timer-events", "--detailed-line-info"] : [],
        ...argv.out ? [`--logfile=${argv.out}`, "--no-logfile-per-isolate"] : [],
    ];
    throw new Error(`Unsupported V8 version: '${process.versions.v8}`);
}

function showHelp() {
    const lines = [
        `dexnode [options] [--] <executable> [executable_options]`,
        `options:`,
        `  -h --help        print this message`,
        `     --no-maps     exclude v8 maps from log`,
        `     --no-ics      exclude ics from log`,
        `     --no-deopts   exclude deopts from log`,
        `     --no-profile  exclude cpu profile from log`,
        `     --no-sources  exclude sources from log`,
        `     --no-quiet    write dexnode messages to stdout (default)`,
        `     --maps        include v8 maps in log (default)`,
        `     --ics         include ics in log (default)`,
        `     --deopts      include deopts in log (default)`,
        `     --profile     include cpu profile in log (default)`,
        `     --sources     include sources in log (default)`,
        `     --quiet       do not write dexnode messages to stdout`,
        `     --out FILE    write all log output to FILE (default: isolate-<pid>-<isolate id>-v8.log)`,
        `     --            pass all remaining arguments to node`,
    ];
    console.log(lines.join("\n"));
}

function main() {
    const args = [...getV8Flags(), ...argv._];
    if (!argv.quiet) {
        console.log(`$ node ${args.join(" ")}`);
    }
    const result = child_process.spawnSync(process.argv0, args, { stdio: "inherit" });
    process.exit(result.status ?? undefined);
}