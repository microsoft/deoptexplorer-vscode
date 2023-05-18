// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { type Host } from "../host.js";
import { HostFlags } from "../hostFlags.js";
import { isElectron } from "../util.js";

export const HOST_ELECTRON: Host<"electron"> = {
    flagName: "electron",
    flags:
        HostFlags.ChromiumArguments |
        HostFlags.DetectV8Version |
        (isElectron ? HostFlags.IsCurrent : HostFlags.None),

    v8VersionDetection: {
        env: { ELECTRON_RUN_AS_NODE: "1" },
        args: ["-p", "process.versions.v8"]
    },
};

