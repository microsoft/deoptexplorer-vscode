// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { HostFlags } from "./hostFlags.js";

export interface RegistryLookup {
    readonly hive?: string;
    readonly key: string;
    readonly value?: string;
}

export interface Host<S extends string = string> {
    readonly flagName: S;
    readonly flags: HostFlags;
    readonly paths?: Readonly<Partial<Record<NodeJS.Platform, readonly string[]>>>;
    readonly registry?: readonly RegistryLookup[];
    readonly v8VersionDetection?: { args?: readonly string[]; env?: NodeJS.ProcessEnv; };
}
