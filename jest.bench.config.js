// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: "./scripts/benchmark-environment",
    roots: [
        '<rootDir>/src/core/collections',
        '<rootDir>/src/third-party-derived/v8',
    ],
    testMatch: ["**/__benchmarks__/**/*.benchmark.[jt]s?(x)"],
    maxConcurrency: 1,
    maxWorkers: 1,
    moduleNameMapper: {
        "^vscode$": "<rootDir>/scripts/vscodeMock.js",
    },
    transformIgnorePatterns: ["/node_modules/", "^vscode$"],
    unmockedModulePathPatterns: ["^vscode$"],
    reporters: ["default", ["jest-bench/reporter", { withOpsPerSecond: true }]]
};