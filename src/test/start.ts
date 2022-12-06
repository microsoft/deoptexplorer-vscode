// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from 'path';

// async function runWithMocha(): Promise<void> {
//     type Mocha = import("mocha");
//     const Mocha = await import("mocha");
//     const glob = await import("glob");
//     // Create the mocha test
//     const mocha = new Mocha({ ui: 'bdd', });
//     mocha.useColors(true);

//     const patterns = [
//         "**/*.test.js",
//         "**/__test__/[^_]*.js"
//     ];
//     const base = path.resolve(__dirname, '..');
//     const files = (await Promise.all(patterns.map(pattern => findFiles(pattern, base)))).flat();
//     for (const file of files) {
//         mocha.addFile(path.resolve(base, file));
//     }

//     await runMocha(mocha);

//     function findFiles(pattern: string, base: string) {
//         return new Promise<string[]>((resolve, reject) => glob(pattern, { cwd: base }, (err, files) => err ? reject(err) : resolve(files)));
//     }
    
//     function runMocha(mocha: Mocha) {
//         return new Promise<void>((resolve, reject) => mocha.run(failures => failures ? reject(new Error(`${failures} tests failed.`)) : resolve()));
//     }
// }

async function runWithJest() {
    const { Writable } = await import("stream");

    let pendingOutput = "";
    const stdout = new Writable({
        write(chunk, _encoding, cb) {
            pendingOutput += chunk.toString();
            if (/\r?\n/.test(pendingOutput)) {
                const lines = pendingOutput.split(/\r?\n/g);
                pendingOutput = lines.pop() ?? "";
                console.log(lines.join("\n"));
            }
            cb();
        },
        final(cb) {
            if (pendingOutput) {
                console.log(pendingOutput);
                pendingOutput = "";
            }
            cb();
        }
    });
    stdout.setDefaultEncoding("utf8");

    const savedStdout = Object.getOwnPropertyDescriptor(process, "stdout");
    const savedStderr = Object.getOwnPropertyDescriptor(process, "stderr");
    Object.defineProperty(process, "stdout", { enumerable: savedStdout?.enumerable, configurable: savedStdout?.configurable, get: () => stdout });
    Object.defineProperty(process, "stderr", { enumerable: savedStdout?.enumerable, configurable: savedStdout?.configurable, get: () => stdout });

    // work around jest intercepting require
    (process as any).__requireVSCode = () => require("vscode");

    const { runCLI } = await import("jest");
    try {
        const projectRootPath = path.resolve(__dirname, "../..");

        process.chdir(projectRootPath);
        const cliResult = await runCLI({
            rootDir: projectRootPath,
            runInBand: true,
        } as Parameters<typeof runCLI>[0], [projectRootPath]);

        if (!cliResult.results.success) {
            process.exitCode = cliResult.results.numFailedTests || -1;
            throw new Error(`One or more tests failed.`);
        }
    }
    finally {
        if (savedStdout) Object.defineProperty(process, "stdout", savedStdout);
        if (savedStderr) Object.defineProperty(process, "stderr", savedStderr);
    }
}

export async function run(): Promise<void> {
    // await runWithMocha();
    await runWithJest();
}