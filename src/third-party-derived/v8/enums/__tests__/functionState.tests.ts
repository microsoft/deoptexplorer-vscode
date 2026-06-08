// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { FunctionState, parseFunctionState } from "../functionState";

describe("parseFunctionState", () => {
    it.each`
        input      | expected
        ${"+"}     | ${FunctionState.OptimizedTurboprop}
        ${"+''"}   | ${FunctionState.OptimizedTurboprop}
        ${"'+''"}  | ${FunctionState.OptimizedTurboprop}
        ${"''"}    | ${FunctionState.Compiled}
    `("parses V8 function state marker $input", ({ input, expected }) => {
        expect(parseFunctionState(input)).toBe(expected);
    });
});
