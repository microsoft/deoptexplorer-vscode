// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { type Host } from "../host.js";
import { HostFlags } from "../hostFlags.js";

export const HOST_CHROME_STABLE: Host<"chrome"> = {
    flagName: "chrome",
    flags:
        HostFlags.ChromiumArguments |
        HostFlags.UseLatestV8Version,
    paths: {
        win32: [
            "C:/Program Files/Google/Chrome/Application/chrome.exe",
            "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
            "chrome"
        ],
        darwin: [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ],
        linux: [
            "/usr/bin/google-chrome-stable",
            "/usr/bin/google-chrome",
            "google-chrome-stable",
            "chrome"
        ],
    },
    registry: [
        { key: "SOFTWARE\\Clients\\StartMenuInternet\\Google Chrome\\shell\\open\\command" },
        { key: "SOFTWARE\\Wow6432Node\\Clients\\StartMenuInternet\\Google Chrome\\shell\\open\\command" },
    ]
};
