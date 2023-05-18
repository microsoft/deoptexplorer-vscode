// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export const enum HostFlags {
    None = 0,

    NodeJSArguments = 1 << 0,
    DenoArguments = 2 << 0,
    ChromiumArguments = 3 << 0,
    ArgumentsMask = NodeJSArguments | DenoArguments | ChromiumArguments,

    DetectV8Version = 1 << 2,
    UseLatestV8Version = 1 << 3,
    IsCurrent = 1 << 4,
    UseNoLogfilePerIsolate = 1 << 5,
}
