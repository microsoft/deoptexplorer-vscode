// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import child_process from "child_process";
import { getHostExecPath, HOSTS } from "./hosts.js";
import { HostFlags } from "./hostFlags.js";
import { Host } from "./host.js";

export type HostFlagKey = typeof HOSTS[number]["flagName"];
export type HostOptions = Partial<Record<HostFlagKey, boolean>>;

export interface Options extends HostOptions {
    maps?: boolean;
    ics?: boolean;
    deopts?: boolean;
    profile?: boolean;
    sources?: boolean;
    quiet?: boolean;
    help?: boolean;
    v8_version?: string;
    exec_path?: string;
    out?: string;
    host: Host;
    _: string[];
}

const HOST_FLAG_NAMES: readonly HostFlagKey[] = HOSTS.map(host => host.flagName);
const MUTUALLY_EXCLUSIVE_BOOLEAN_GROUPS = [HOST_FLAG_NAMES] as const;
const BOOLEANS: ReadonlySet<string> = new Set(["maps", "ics", "deopts", "profile", "sources", "quiet", "help", ...HOST_FLAG_NAMES]);
const STRINGS: ReadonlySet<string> = new Set(["v8_version", "exec_path", "out"]);
const ALIASES = { h: "help", "?": "help" } as const;
const DEFAULTS: Readonly<Partial<Options>> = {
    maps: true,
    ics: true,
    deopts: true,
    profile: true,
    sources: true,
    help: false,
    quiet: false,
};

function parse(args: string[]) {
    const argv: Options = Object.create(null);
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
            if (!(arg in ALIASES)) break;
            arg = (ALIASES as any)[arg];
        }
        else {
            // stop parsing if argument is not an option
            break;
        }

        // negate if starts with no-
        if (arg.startsWith("no-") || arg.startsWith("no_")) {
            arg = arg.slice(3);
            value = false;
        }

        // extract argument value
        const eqIndex = arg.indexOf("=");
        if (eqIndex >= 0) {
            value = arg.slice(eqIndex + 1);
            arg = arg.slice(0, eqIndex);
        }

        arg = arg.replaceAll("-", "_");
        if (STRINGS.has(arg)) {
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
        else if (BOOLEANS.has(arg)) {
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

    return { ...DEFAULTS, ...argv, _: args };
}

function keyToSwitch(key: string) {
    return `--${key.replaceAll("_", "-")}`;
}

function validateConflicts(argv: Options) {
    // report conflicts
    for (const mutuallyExclusiveBooleanGroup of MUTUALLY_EXCLUSIVE_BOOLEAN_GROUPS) {
        for (let i = 0; i < mutuallyExclusiveBooleanGroup.length; i++) {
            const option = mutuallyExclusiveBooleanGroup[i];
            if (argv[option]) {
                for (let j = i + 1; j < mutuallyExclusiveBooleanGroup.length; j++) {
                    const other = mutuallyExclusiveBooleanGroup[j];
                    if (argv[other]) throw new Error(`'${keyToSwitch(option)}' cannot be used with '${keyToSwitch(other)}'`);
                }
            }
        }
    }
}

function detectHost(argv: Options) {
    for (const host of HOSTS) {
        if (argv[host.flagName] === undefined && !HOSTS.some(host => argv[host.flagName])) {
            argv[host.flagName] = !!(host.flags & HostFlags.IsCurrent);
        }
    }

    const host = HOSTS.find(host => argv[host.flagName]);
    if (!host) {
        const switchNames = HOST_FLAG_NAMES.map(flagName => `'${keyToSwitch(flagName)}'`);
        const formatter = new Intl.ListFormat("en-US", { type: "disjunction", style: "long" });
        const formattedSwitchNames = formatter.format(switchNames);
        throw new Error(`Could not detect host. Please specify one of ${formattedSwitchNames}`);
    }

    return host;
}

async function autodetectExecPath(argv: Options, host: Host) {
    if (!argv.exec_path) {
        argv.exec_path = await getHostExecPath(host);
    }
}

function autodetectV8Version(argv: Options, host: Host) {
    if (!argv.v8_version && host.flags & HostFlags.DetectV8Version) {
        if (host.flags & HostFlags.IsCurrent) {
            argv.v8_version = process.versions.v8;
        }
        else if (argv.exec_path && host.v8VersionDetection) {
            const result = child_process.spawnSync(argv.exec_path, host.v8VersionDetection.args, {
                encoding: "utf8",
                stdio: "pipe",
                env: host.v8VersionDetection.env,
            });
            argv.v8_version = result.stdout.trim();
        }
    }

    if (!argv.v8_version && host.flags & HostFlags.UseLatestV8Version) {
        argv.v8_version = "latest";
    }
}

export async function parseArgs(args: string[]): Promise<Options> {
    if (!args.length) showHelpAndExit();

    const argv = parse(args);
    validateConflicts(argv);

    const host = detectHost(argv);
    await autodetectExecPath(argv, host);
    autodetectV8Version(argv, host);

    return { ...argv, host };
}

function showHelp() {
    const lines = [
        `dexnode [options] [--] <script_or_url> [host_options]`,
        `options:`,
        `  -h --help                 print this message`,
        `     --quiet                do not write dexnode messages to stdout`,
        `     --no-maps              exclude v8 maps from log`,
        `     --no-ics               exclude ics from log`,
        `     --no-deopts            exclude deopts from log`,
        `     --no-profile           exclude cpu profile from log`,
        `     --no-sources           exclude sources from log`,
        `     --maps                 include v8 maps in log (default)`,
        `     --ics                  include ics in log (default)`,
        `     --deopts               include deopts in log (default)`,
        `     --profile              include cpu profile in log (default)`,
        `     --sources              include sources in log (default)`,
        `     --chrome               use arguments for Chrome instead of NodeJS`,
        `     --msedge               use arguments for Edge instead of NodeJS`,
        `     --deno                 use arguments for Deno instead of NodeJS (autodetected)`,
        `     --electron             use arguments for Electron instead of NodeJS (autodetected)`,
        `     --nodejs               use arguments for NodeJS (default)`,
        `     --v8-version VERSION   use arguments specific to the provided V8 version`,
        `     --exec-path FILE       use the provided host executable (autodetected)`,
        `     --out FILE             write all log output to FILE (default: isolate-<pid>-<isolate id>-v8.log)`,
        `     --                     pass all remaining arguments to node`,
    ];
    console.log(lines.join("\n"));
}

function showHelpAndExit(): never {
    showHelp();
    process.exit(0);
}
