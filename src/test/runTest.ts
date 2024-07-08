// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from 'path';

import { runTests } from '@vscode/test-electron';

async function main() {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to the extension test script
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './start');

		// Download VS Code, unzip it and run the integration test
		await runTests({ version: "1.90.0", extensionDevelopmentPath, extensionTestsPath });
	} catch {
		console.error('Failed to run tests');
		process.exit(1);
	}
}

main();