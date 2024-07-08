// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Benchmark from "benchmark";
import { saveResult } from "jest-bench/dist/store";
import type { Context } from "vm";

export interface BenchmarkOptions extends Benchmark.Options {
    timeout?: number;
}

interface Suite {
    name: string;
    next: Suite | undefined;
}

const symDescribeStack = Symbol.for("deoptexplorer-benchmark-describe-stack");
const symTestName = Symbol.for("deoptexplorer-benchmark-running-test");

function getDescribeStack() {
    return (globalThis as any)[symDescribeStack] as Suite | undefined;
}

function getSuiteName() {
    const suite = getDescribeStack();
    let suiteName: string = '';
    for (let current = suite; current; current = current.next) {
        suiteName = suiteName ? `${current.name} ${suiteName}` : current.name;
    }
    return suiteName;
}

function getTestName() {
    return (globalThis as any)[symTestName] as string | undefined;
}

function setFunctionLength<T extends (...args: any) => any>(fn: T, length: number): T {
    return Object.defineProperty(fn, "length", { ...Object.getOwnPropertyDescriptor(fn, "length"), value: length });
}

function makeBenchmarkCallback(name: string, fn: (...args: any) => any, { ...options }: Omit<BenchmarkOptions, "timeout"> = {}, eachParamCount = 0): jest.ProvidesCallback {
    const suiteName = getSuiteName();
    const defer = eachParamCount < fn.length;
    return setFunctionLength((...args: any[]) => new Promise<void>((resolve, reject) => {
        const eachArgs = args.slice(0, eachParamCount);
        let wrap: ((...args: any) => any) | undefined;
        if (eachArgs.length) {
            wrap = fn.bind(null, ...eachArgs);
        }

        const testName = getTestName() ?? name;
        const supportsDecompilation = Benchmark.support.decompilation;
        try {
            Benchmark.support.decompilation = false;
            const benchmark = new Benchmark(testName, wrap ?? fn, {
                ...options,
                defer: defer,
                onComplete: () => {
                    try {
                        saveResult(suiteName, testName, benchmark);
                        options?.onComplete?.();
                        resolve();
                    }
                    catch (e) {
                        reject(e);
                    }
                },
                onError: (reason: unknown) => {
                    try {
                        options?.onError?.(reason);
                        reject(reason);
                    }
                    catch (e) {
                        reject(e);
                    }
                }
            }).run({ async: true });
        }
        finally {
            Benchmark.support.decompilation = supportsDecompilation;
        }
    }), fn.length);
}

interface Bench {
    (name: string, fn?: jest.ProvidesCallback, options?: BenchmarkOptions): void;
    only: Bench;
    skip: Bench;
    todo: Bench;
    each: BenchEach;
}

interface BenchEach {
    // Exclusively arrays.
    <T extends any[] | [any]>(cases: ReadonlyArray<T>): (
        name: string,
        fn: (...args: T) => any,
        options?: BenchmarkOptions,
    ) => void;
    <T extends ReadonlyArray<any>>(cases: ReadonlyArray<T>): (
        name: string,
        fn: (...args: ExtractEachCallbackArgs<T>) => any,
        options?: BenchmarkOptions,
    ) => void;
    // Not arrays.
    <T>(cases: ReadonlyArray<T>): (name: string, fn: (arg: T, done: jest.DoneCallback) => any, options?: BenchmarkOptions) => void;
    (cases: ReadonlyArray<ReadonlyArray<any>>): (
        name: string,
        fn: (...args: any[]) => any,
        options?: BenchmarkOptions,
    ) => void;
    (strings: TemplateStringsArray, ...placeholders: any[]): (
        name: string,
        fn: (arg: any, done: jest.DoneCallback) => any,
        options?: BenchmarkOptions,
    ) => void;
}

export function benchmark(name: string, fn: jest.ProvidesCallback, { timeout, ...options }: BenchmarkOptions = {}) {
    it(name, makeBenchmarkCallback(name, fn, options), timeout ?? 60 * 1000);
}

const isTable = (table: readonly any[]): table is readonly (readonly any[])[] => table.every(Array.isArray);

function makeBench(it: jest.It): Bench {
    const bench = ((name, fn, { timeout, ...options } = {}) => it(name, makeBenchmarkCallback(name, fn!, options), timeout)) as Bench;
    if (it.skip) bench.skip = makeBench(it.skip);
    if (it.only) bench.only = makeBench(it.only);
    if (it.todo) bench.todo = makeBench(it.todo);
    if (it.each) bench.each = makeEach(it.each);
    return bench;
}

function makeEach(it: jest.Each): BenchEach {
    if (!it) return undefined!;
    function each(...args: [readonly any[], ...any[]]) {
        const cases = args[0];
    
        let eachParamCount = 0;
        const isTaggedTemplate = args.length > 1;
        if (isTaggedTemplate || !isTable(cases)) {
            eachParamCount = 1;
        }
        else {
            for (const row of cases) {
                eachParamCount = Math.max(eachParamCount, row.length);
            }
        }
    
        const itEach: (name: string, fn: (...args: any) => any, timeout?: number) => void = it.apply(null, args as any);
        return (name: string, fn: (...args: any) => any, { timeout, ...options }: BenchmarkOptions = {}) =>
            itEach(name, makeBenchmarkCallback(name, fn, options, eachParamCount), timeout ?? 60 * 1000);
    }
    return each as BenchEach;
}

benchmark.skip = makeBench(it.skip);
benchmark.only = makeBench(it.only);
benchmark.todo = makeBench(it.todo);
benchmark.each = makeEach(it.each);
