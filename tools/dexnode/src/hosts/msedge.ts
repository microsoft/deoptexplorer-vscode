// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { type Host } from "../host.js";
import { HostFlags } from "../hostFlags.js";

export const HOST_MSEDGE_STABLE: Host<"msedge"> = {
    flagName: "msedge",
    flags:
        HostFlags.ChromiumArguments |
        HostFlags.UseLatestV8Version,
    paths: {
        win32: [
            "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
            "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        ],
        darwin: [
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ],
        linux: [
            "/opt/microsoft/msedge/msedge",
            "/usr/bin/microsoft-edge-stable",
            "microsoft-edge-stable"
        ],
    },
    registry: [
        { key: "SOFTWARE\\Clients\\StartMenuInternet\\Microsoft Edge\\shell\\open\\command" },
        { key: "SOFTWARE\\Wow6432Node\\Clients\\StartMenuInternet\\Microsoft Edge\\shell\\open\\command" },
    ],
};
