// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import path from "path";
import { type Host } from "../host.js";
import { HostFlags } from "../hostFlags.js";

export const HOST_CHROME_STABLE: Host<"chrome"> = {
    flagName: "chrome",
    flags:
        HostFlags.ChromiumArguments |
        HostFlags.UseLatestV8Version,
    paths: {
        win32: [
            "chrome",
            "C:/Program Files/Google/Chrome/Application/chrome.exe",
            "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
        ],
        darwin: [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ],
        linux: [
            "chrome",
            "google-chrome-stable",
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
        ],
    },
    registry: [
        { key: "SOFTWARE\\Clients\\StartMenuInternet\\Google Chrome\\shell\\open\\command" },
        { key: "SOFTWARE\\Wow6432Node\\Clients\\StartMenuInternet\\Google Chrome\\shell\\open\\command" },
    ]
};

export const HOST_CHROME_DEV: Host<"chrome_dev"> = {
    flagName: "chrome_dev",
    flags:
        HostFlags.ChromiumArguments |
        HostFlags.UseLatestV8Version,
    paths: {
        win32: [
            "C:/Program Files/Google/Chrome Dev/Application/chrome.exe",
            "C:/Program Files (x86)/Google/Chrome Dev/Application/chrome.exe",
        ],
        darwin: [
            "/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev",
        ],
        linux: [
            "google-chrome-dev",
            "/usr/bin/google-chrome-dev",
        ],
    },
    registry: [
        { key: "SOFTWARE\\Clients\\StartMenuInternet\\Google Chrome Dev\\shell\\open\\command" },
        { key: "SOFTWARE\\Wow6432Node\\Clients\\StartMenuInternet\\Google Chrome Dev\\shell\\open\\command" },
    ]
};

export const HOST_CHROME_BETA: Host<"chrome_beta"> = {
    flagName: "chrome_beta",
    flags:
        HostFlags.ChromiumArguments |
        HostFlags.UseLatestV8Version,
    paths: {
        win32: [
            "C:/Program Files/Google/Chrome Beta/Application/chrome.exe",
            "C:/Program Files (x86)/Google/Chrome Beta/Application/chrome.exe",
        ],
        darwin: [
            "/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta",
        ],
        linux: [
            "google-chrome-beta",
            "/usr/bin/google-chrome-beta",
        ],
    },
    registry: [
        { key: "SOFTWARE\\Clients\\StartMenuInternet\\Google Chrome Beta\\shell\\open\\command" },
        { key: "SOFTWARE\\Wow6432Node\\Clients\\StartMenuInternet\\Google Chrome Beta\\shell\\open\\command" },
    ]
};

export const HOST_CHROME_CANARY: Host<"chrome_canary"> = {
    flagName: "chrome_canary",
    flags:
        HostFlags.ChromiumArguments |
        HostFlags.UseLatestV8Version,
    paths: {
        win32: process.platform === "win32" && process.env.LOCALAPPDATA ?
            [path.resolve(process.env.LOCALAPPDATA, "Google\\Chrome SxS\\Application\\chrome.exe")] :
            undefined,
        darwin: [], // TODO
        linux: [
            "google-chrome-canary",
            "/usr/bin/google-chrome-canary",
        ],
    },
    registry: [
    ],
};
