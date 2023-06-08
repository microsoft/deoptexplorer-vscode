// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

module.exports = {
    preset: 'ts-jest',
    roots: ['<rootDir>/src/'],
    testEnvironment: '<rootDir>/scripts/vscode-environment.js',
    testMatch: [
        "**/__test?(s)__/**/*.[jt]s?(x)",
        "**/?(*.)+(spec|test?(s)).[jt]s?(x)"
    ],
    moduleNameMapper: {
        "^vscode$": "<rootDir>/scripts/vscode.js",
    },
    transformIgnorePatterns: ["/node_modules/", "^vscode$"],
    unmockedModulePathPatterns: ["^vscode$"]
};