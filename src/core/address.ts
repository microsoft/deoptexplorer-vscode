// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export type Address = bigint; // TODO: may want to switch to bigint

export function tryParseAddress(text: string): Address | undefined {
    try {
        return parseAddress(text);
    }
    catch {
        return undefined;
    }
}

export function parseAddress(text: string): Address {
    if (text.length > 2 && text.charAt(0) === "0") {
        const ch1 = text.charAt(1);
        if (ch1 === "x" || ch1 === "X") {
            return BigInt(text);
        }
    }
    return BigInt(`0x${text}`);
}

export function formatAddress(value: Address) {
    return `0x${value.toString(16).padStart(12, "0")}`;
}

export function isAddress(value: unknown): value is Address {
    return typeof value === "bigint";
}

export function toAddress(value: number | Address): Address {
    return BigInt(value);
}
