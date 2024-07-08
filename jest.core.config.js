// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

module.exports = {
    preset: 'ts-jest',
    roots: [
        '<rootDir>/src/core/collections',
        '<rootDir>/src/third-party-derived/v8',
    ],
    testMatch: [
        "**/__test?(s)__/**/*.[jt]s?(x)",
        "**/?(*.)+(spec|test?(s)).[jt]s?(x)"
    ],
    moduleNameMapper: {
        "^vscode$": "<rootDir>/scripts/vscodeMock.js",
    },
    transformIgnorePatterns: ["/node_modules/", "^vscode$"],
    unmockedModulePathPatterns: ["^vscode$"]
};