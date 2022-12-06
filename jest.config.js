module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src/'],
    moduleNameMapper: { "^vscode$": "<rootDir>/scripts/vscode.js" },
    transformIgnorePatterns: ["/node_modules/", "^vscode$"],
    unmockedModulePathPatterns: ["^vscode$"]
};