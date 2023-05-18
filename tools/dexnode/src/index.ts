// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import child_process from "child_process";
import path from "path";
import { parseArgs } from "./args.js";
import { getHostExecArgs } from "./hosts.js";
import { prepareV8Flags } from "./v8.js";

const argv = await parseArgs(process.argv.slice(2));
if (!argv.exec_path) throw new Error("Could not detect host. Please specify '--exec-path' with the path to the host executable");
if (!argv.v8_version) throw new Error("Could not determine V8 version. Please specify a valid version using '--v8-version'.");

const { flags, cleanup } = prepareV8Flags(argv, argv.v8_version ?? "");
const args = getHostExecArgs(argv, flags);

if (!argv.quiet) {
    const processName = path.basename(argv.exec_path);
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
