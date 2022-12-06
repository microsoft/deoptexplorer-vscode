// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { createHash, randomBytes } from "crypto";

/**
 * Creates a `nonce` value that can be used in a content security policy.
 * @returns A base-64 encoded MD5 hash of 16 random bytes.
 */
export function createNonce() {
    return createHash("MD5")
        .update(randomBytes(16))
        .digest()
        .toString("base64");
}
