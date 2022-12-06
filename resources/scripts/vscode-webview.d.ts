/// <reference lib="dom" />

interface VsCodeApi {
    postMessage(msg: unknown): void;
    getState(): Record<string, unknown>;
    setState(state: Record<string, unknown>): Record<string, unknown>;
}

declare function acquireVsCodeApi(): VsCodeApi;