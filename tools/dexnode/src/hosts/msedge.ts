// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import path from "path";
import { type Host } from "../host.js";
import { HostFlags } from "../hostFlags.js";

export const HOST_MSEDGE_STABLE: Host<"msedge"> = {
    flagName: "msedge",
    flags:
        HostFlags.ChromiumArguments |
        HostFlags.UseLatestV8Version,
    paths: {
        win32: [
            "msedge",
            "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
            "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        ],
        darwin: [
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ],
        linux: [
            "microsoft-edge-stable",
            "/opt/microsoft/msedge/msedge",
            "/usr/bin/microsoft-edge-stable",
        ],
    },
    registry: [
        { key: "SOFTWARE\\Clients\\StartMenuInternet\\Microsoft Edge\\shell\\open\\command" },
        { key: "SOFTWARE\\Wow6432Node\\Clients\\StartMenuInternet\\Microsoft Edge\\shell\\open\\command" },
    ],
};

export const HOST_MSEDGE_DEV: Host<"msedge_dev"> = {
    flagName: "msedge_dev",
    flags:
        HostFlags.ChromiumArguments |
        HostFlags.UseLatestV8Version,
    paths: {
        win32: [
            "C:/Program Files/Microsoft/Edge Dev/Application/msedge.exe",
            "C:/Program Files (x86)/Microsoft/Edge Dev/Application/msedge.exe",
        ],
        darwin: [
            "/Applications/Microsoft Edge Dev.app/Contents/MacOS/Microsoft Edge Dev",
        ],
        linux: [
            "microsoft-edge-dev",
            "/opt/microsoft/msedge-dev/msedge",
            "/opt/microsoft/msedge-dev/msedge-dev",
            "/usr/bin/microsoft-edge-dev",
        ],
    },
    registry: [
        { key: "SOFTWARE\\Clients\\StartMenuInternet\\Microsoft Edge Dev\\shell\\open\\command" },
        { key: "SOFTWARE\\Wow6432Node\\Clients\\StartMenuInternet\\Microsoft Edge Dev\\shell\\open\\command" },
    ],
};

export const HOST_MSEDGE_BETA: Host<"msedge_beta"> = {
    flagName: "msedge_beta",
    flags:
        HostFlags.ChromiumArguments |
        HostFlags.UseLatestV8Version,
    paths: {
        win32: [
            "C:/Program Files/Microsoft/Edge Beta/Application/msedge.exe",
            "C:/Program Files (x86)/Microsoft/Edge Beta/Application/msedge.exe",
        ],
        darwin: [
            "/Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta",
        ],
        linux: [
            "microsoft-edge-beta",
            "/opt/microsoft/msedge-beta/msedge",
            "/opt/microsoft/msedge-beta/msedge-beta",
            "/usr/bin/microsoft-edge-beta",
        ],
    },
    registry: [
        { key: "SOFTWARE\\Clients\\StartMenuInternet\\Microsoft Edge Beta\\shell\\open\\command" },
        { key: "SOFTWARE\\Wow6432Node\\Clients\\StartMenuInternet\\Microsoft Edge Beta\\shell\\open\\command" },
    ],
};

export const HOST_MSEDGE_CANARY: Host<"msedge_canary"> = {
    flagName: "msedge_canary",
    flags:
        HostFlags.ChromiumArguments |
        HostFlags.UseLatestV8Version,
    paths: {
        win32: process.platform === "win32" && process.env.LOCALAPPDATA ?
            [path.resolve(process.env.LOCALAPPDATA, "Microsoft\\Edge SxS\\Application\\msedge.exe")] :
            undefined,
        darwin: [], // TODO
        linux: [
            "microsoft-edge-canary",
            "/opt/microsoft/msedge-canary/msedge",
            "/opt/microsoft/msedge-canary/msedge-canary",
            "/usr/bin/microsoft-edge-canary",
        ],
    },
    registry: [
    ],
};
