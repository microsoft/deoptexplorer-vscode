// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export class MemoryCategory {
    constructor(
        readonly name: string,
        public size: number,
        public maxSize: number,
    ) {}
}
