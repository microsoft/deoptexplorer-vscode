// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { type Host } from "../host.js";
import { HostFlags } from "../hostFlags.js";
import { isDeno } from "../util.js";

export const HOST_DENO: Host<"deno"> = {
    flagName: "deno",
    flags:
        HostFlags.DenoArguments |
        HostFlags.DetectV8Version |
        HostFlags.UseNoLogfilePerIsolate |
        (isDeno ? HostFlags.IsCurrent : HostFlags.None),

    v8VersionDetection: { args: ["eval", "process.stdout.write(process.versions.v8)"] },
};
