// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Options } from "./args.js";
import { Host } from "./host.js";
import { HostFlags } from "./hostFlags.js";
import { HOST_CHROME_BETA, HOST_CHROME_CANARY, HOST_CHROME_DEV, HOST_CHROME_STABLE } from "./hosts/chrome.js";
import { HOST_DENO } from "./hosts/deno.js";
import { HOST_ELECTRON } from "./hosts/electron.js";
import { HOST_MSEDGE_BETA, HOST_MSEDGE_CANARY, HOST_MSEDGE_DEV, HOST_MSEDGE_STABLE } from "./hosts/msedge.js";
import { HOST_NODEJS } from "./hosts/nodejs.js";
import { regQuery, which } from "./util.js";
import Registry = require("winreg");

export const HOSTS = [
    HOST_NODEJS,
    HOST_DENO,
    HOST_ELECTRON,
    HOST_CHROME_STABLE,
    HOST_CHROME_BETA,
    HOST_CHROME_DEV,
    HOST_CHROME_CANARY,
    HOST_MSEDGE_STABLE,
    HOST_MSEDGE_BETA,
    HOST_MSEDGE_DEV,
    HOST_MSEDGE_CANARY,
] as const;

async function * getExecPathCandidates(host: Host) {
    if (process.platform === "win32" && host.registry) {
        for (const regKey of host.registry) {
            const candidate = await regQuery(regKey.hive ?? Registry.HKLM, regKey.key, regKey.value);
            if (candidate) {
                yield candidate;
            }
        }
    }

    const execPaths = host.paths?.[process.platform] ?? host.paths?.linux;
    if (execPaths) {
        yield* execPaths;
    }
}

export async function getHostExecPath(host: Host) {
    if (host.flags & HostFlags.IsCurrent) {
        return process.execPath;
    }

    for await (const candidate of getExecPathCandidates(host)) {
        const execPath = which(candidate);
        if (execPath) {
            return execPath;
        }
    }
}

export function getHostExecArgs(argv: Options, v8Flags: string[]) {
    const args: string[] = [];
    switch (argv.host.flags & HostFlags.ArgumentsMask) {
        case HostFlags.ChromiumArguments:
            args.push("--no-sandbox");
            args.push(`--js-flags=${v8Flags.join(',')}`);
            args.push(...argv._);
            break;
        case HostFlags.DenoArguments:
            args.push("run");
            args.push(`--v8-flags=${v8Flags.join(",")}`);
            args.push(...argv._);
            break;
        case HostFlags.NodeJSArguments:
            args.push(...v8Flags);
            args.push(...argv._);
            break;
    }
    return args;
}
