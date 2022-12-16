// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { MemoryCategory } from "./memoryCategory";

export class MemoryOverview {
    constructor(
        readonly heapCapacity: number,
        readonly heapAvailable: number,
        readonly size: number,
        readonly maxSize: number,
        readonly memorySizes: ReadonlyMap<string, MemoryCategory>,
        readonly entrySizes: ReadonlyMap<string, MemoryCategory>,
    ) {}
}