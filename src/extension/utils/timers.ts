// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export function setTimeoutSafe<F extends (...args: any[]) => void>(callback: F, ms: number, ...args: Parameters<F>): NodeJS.Timeout {
    return setTimeout(callback, ms, ...args);
}

export function setIntervalSafe<F extends (...args: any[]) => void>(callback: F, ms: number, ...args: Parameters<F>): NodeJS.Timeout {
    return setInterval(callback, ms, ...args);
}

export function setImmediateSafe<F extends (...args: any[]) => void>(callback: F, ...args: Parameters<F>): NodeJS.Immediate {
    return setImmediate(callback, ...args);
}

export function nextTickSafe<F extends (...args: any[]) => void>(callback: F, ...args: Parameters<F>): void {
    process.nextTick(callback, ...args);
}
