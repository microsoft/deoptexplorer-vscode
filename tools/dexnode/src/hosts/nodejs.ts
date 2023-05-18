// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { type Host } from "../host.js";
import { HostFlags } from "../hostFlags.js";
import { isNodeJS } from "../util.js";

export const HOST_NODEJS: Host<"nodejs"> = {
    flagName: "nodejs",
    flags:
        HostFlags.NodeJSArguments |
        HostFlags.DetectV8Version |
        HostFlags.UseNoLogfilePerIsolate |
        (isNodeJS ? HostFlags.IsCurrent : HostFlags.None),
    
    v8VersionDetection: { args: ["-p", "process.versions.v8"] },
};

