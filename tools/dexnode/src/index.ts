// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import child_process from "child_process";
import semver from "semver";
import path from "path";
import fs from "fs";
import os from "os";
import Registry from "winreg";

declare global {
    var Deno: { version?: { v8?: string; }; } | undefined;
}

const chromeDefaultPaths: Partial<Record<NodeJS.Platform, string[]>> = {
    win32: ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"],
    darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
    linux: ["/usr/bin/google-chrome-stable", "/usr/bin/google-chrome"],
};

const chromeRegKeys = [
    "SOFTWARE\\Clients\\StartMenuInternet\\Google Chrome\\shell\\open\\command",
    "SOFTWARE\\Wow6432Node\\Clients\\StartMenuInternet\\Google Chrome\\shell\\open\\command"
];

const msedgeDefaultPaths: Partial<Record<NodeJS.Platform, string[]>> = {
    win32: ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"],
    darwin: ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"],
    linux: ["/opt/microsoft/msedge/msedge", "/usr/bin/microsoft-edge-stable"],
};

const msedgeRegKeys: string[] = [
    "SOFTWARE\\Clients\\StartMenuInternet\\Microsoft Edge\\shell\\open\\command",
    "SOFTWARE\\Wow6432Node\\Clients\\StartMenuInternet\\Microsoft Edge\\shell\\open\\command"
];

main().catch(e => {
    console.error(e);
    process.exit(1);
});

function canAccess(file: string, flags: number) {
    try {
        if (!fs.existsSync(file)) return false;
        fs.accessSync(file, flags);
        return true;
    }
    catch {
        return false;
    }
}

async function regQuery(hive: string, key: string, valueName: string = Registry.DEFAULT_VALUE) {
    const reg = new Registry({ hive, key });
    const keyExists = await new Promise<boolean>((res, rej) => reg.keyExists((err, exists) => err ? rej(err) : res(exists)));
    if (!keyExists) return undefined;

    const valueExists = await new Promise<boolean>((res, rej) => reg.valueExists(valueName, (err, exists) => err ? rej(err) : res(exists)));
    if (!valueExists) return undefined;

    const value = await new Promise<string>((res, rej) => reg.get(valueName, (err, item) => err ? rej(err) : res(item.value)));
    return value;
}

async function getBrowserPath(browser: string, win32RegKeys: string[], defaultPaths: Partial<Record<NodeJS.Platform, string[]>>) {
    async function * getCandidates() {
        if (process.platform === "win32") {
            for (const regKey of win32RegKeys) {
                const candidate = await regQuery(Registry.HKLM, regKey);
                if (candidate) {
                    yield candidate;
                }
            }
        }
        const execPaths = defaultPaths[process.platform] ?? defaultPaths.linux;
        if (execPaths) {
            yield* execPaths;
        }
    }

    let execPath: string | undefined;
    for await (let candidate of getCandidates()) {
        if (candidate.length >= 2 && candidate.charAt(0) === '"' && candidate.charAt(candidate.length - 1) === '"') {
            candidate = candidate.slice(1, -1);
        }
        if (canAccess(candidate, fs.constants.X_OK)) {
            execPath = candidate;
            break;
        }
    }

    if (!execPath) {
        throw new Error(`Could not find ${browser} executable. Please specify '--exec-path' with the path to the host executable`);
    }

    return execPath;
}

async function main() {
    const NULL_DEVICE =
        process.platform === "win32" ? "\\\\.\\NUL" :
        canAccess("/dev/null", fs.constants.W_OK) ? "/dev/null" :
        null;

    const argv = await parseArgs();
    if (argv.help) {
        showHelp();
        return;
    }

    async function parseArgs() {
        const mutuallyExclusiveBooleans = [["chrome", "msedge", "electron", "deno", "nodejs"]] as const;
        const booleans = new Set(["maps", "ics", "deopts", "profile", "sources", "chrome", "msedge", "electron", "deno", "nodejs", "quiet", "help"]);
        const strings = new Set(["v8_version", "exec_path", "out"]);
        const aliases = { h: "help", "?": "help" };
        const argv: {
            maps?: boolean,
            ics?: boolean,
            deopts?: boolean,
            profile?: boolean,
            sources?: boolean,
            quiet?: boolean,
            chrome?: boolean,
            msedge?: boolean,
            deno?: boolean,
            nodejs?: boolean,
            electron?: boolean,
            help?: boolean,
            v8_version?: string,
            exec_path?: string,
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

            arg = arg.replaceAll("-", "_");
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

        const parsed = {
            maps: true,
            ics: true,
            deopts: true,
            profile: true,
            sources: true,
            chrome: false,
            msedge: false,
            deno: undefined,
            nodejs: undefined,
            help: false,
            quiet: false,
            ...argv,
            _: args,
        };

        if (parsed.help) {
            return parsed;
        }

        // report conflicts
        for (const mutuallyExclusiveBooleanGroup of mutuallyExclusiveBooleans) {
            for (let i = 0; i < mutuallyExclusiveBooleanGroup.length; i++) {
                const option = mutuallyExclusiveBooleanGroup[i];
                if (parsed[option]) {
                    for (let j = i + 1; j < mutuallyExclusiveBooleanGroup.length; j++) {
                        const other = mutuallyExclusiveBooleanGroup[j];
                        if (parsed[other]) throw new Error(`--${option} cannot be used with --${other}`);
                    }
                }
            }
        }

        const isDeno = typeof globalThis.Deno?.version?.v8 === "string";
        const isElectron = !!process.versions.electron;
        const isNodeJS = !!process.versions.node && !isDeno && !isElectron;

        // autodetect host
        if (!parsed.chrome && !parsed.msedge) {
            if (parsed.deno === undefined && !parsed.electron && !parsed.nodejs) {
                parsed.deno = isDeno;
            }
            if (parsed.electron === undefined && !parsed.deno && !parsed.nodejs) {
                parsed.electron = isElectron;
            }
            if (parsed.nodejs === undefined && !parsed.deno && !parsed.electron) {
                parsed.nodejs = true;
            }
            if (!parsed.electron && !parsed.deno && !parsed.nodejs) {
                throw new Error("Could not detect host. Please specify one of '--chrome', '--msedge', '--electron', '--deno', or '--nodejs'");
            }
        }

        // autodetect exec_path
        if (!parsed.exec_path) {
            if (parsed.chrome) {
                parsed.exec_path = await getBrowserPath("chrome", chromeRegKeys, chromeDefaultPaths);
            }
            else if (parsed.msedge) {
                parsed.exec_path = await getBrowserPath("msedge", msedgeRegKeys, msedgeDefaultPaths);
            }
            else {
                const expectedHost =
                    parsed.electron ? "electron" :
                    parsed.deno ? "deno" :
                    parsed.nodejs ? "nodejs" :
                    null;

                const detectedHost =
                    isElectron ? "electron" :
                    isDeno ? "deno" :
                    isNodeJS ? "nodejs" :
                    null;

                if (expectedHost === detectedHost) {
                    parsed.exec_path = process.execPath;
                }
            }
        }

        if (!parsed.v8_version) {
            if (parsed.chrome || parsed.msedge) {
                parsed.v8_version = "latest";
            }
            else {
                parsed.v8_version = process.versions.v8;
            }
        }

        return parsed;
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
            v8_flags.push(`--logfile=${path.resolve(argv.out)}`);
            if (argv.nodejs || argv.deno) {
                v8_flags.push("--no-logfile-per-isolate");
            }
        }

        const v8 = v8version === "latest" ? "latest" : /^\d+\.\d+\.\d+/i.exec(v8version)?.[0];
        const version =
            v8 === undefined ? 0 :
            v8 === "latest" ? 9 :
            semver.satisfies(v8, ">=9.0.0") ? 9 :
            semver.satisfies(v8, ">=8.0.0") ? 8 :
            0;

        if (version === 0) throw new Error(`Unsupported V8 version: '${v8version}. Please specify a valid version using '--v8-version'.`);

        prepareDeopts();
        prepareICs();
        prepareMaps();
        prepareSources();
        prepareProfile();
        prepareOut();
    }

    function prepareHostArgs(v8_flags: string[], args: string[]) {
        if (argv.chrome || argv.msedge || argv.electron) {
            args.push("--no-sandbox");
            args.push(`--js-flags=${v8_flags.join(',')}`);
            args.push(...argv._);
        }
        else if (argv.deno) {
            args.push("run");
            args.push(`--v8-flags=${v8_flags.join(",")}`);
            args.push(...argv._);
        }
        else if (argv.nodejs) {
            args.push(...v8_flags);
            args.push(...argv._);
        }
    }

    if (!argv.exec_path) throw new Error("Could not detect host. Please specify '--exec-path' with the path to the host executable");
    if (!argv.v8_version) throw new Error("Could not determine V8 version. Please specify a valid version using '--v8-version'.");

    const processName = path.basename(argv.exec_path);

    const v8_flags: string[] = [];
    const cleanup: (() => Promise<void> | void)[] = [];
    prepareV8Flags(argv.v8_version ?? "", v8_flags, cleanup);

    const args: string[] = [];
    prepareHostArgs(v8_flags, args);

    if (!argv.quiet) {
        console.log(`> ${processName} ${args.join(" ")}`);
    }

    let result;
    try {
        result = child_process.spawnSync(argv.exec_path, args, { stdio: "inherit" });
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
