// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Uri } from "vscode";
import { resolveUri } from "../uri";

describe("uri", () => {
    it.each`

        input                            | expected
        ${['file://']}                   | ${'file:///'}
        ${['file:///']}                  | ${'file:///'}
        ${['file:///a/b']}               | ${'file:///a/b'}
        ${['file:///a/b/']}              | ${'file:///a/b/'}
        ${['file:///a/b/.']}             | ${'file:///a/b/'}
        ${['file:///a/b/./c']}           | ${'file:///a/b/c'}
        ${['file:///a/b/..']}            | ${'file:///a/'}
        ${['file:///a/b/../c']}          | ${'file:///a/c'}
        ${['file:///a/b', 'c']}          | ${'file:///a/c'}
        ${['file:///a/b/', 'c']}         | ${'file:///a/b/c'}
        ${['file:///a/b/', './c']}       | ${'file:///a/b/c'}
        ${['file:///a/b/', '../c']}      | ${'file:///a/c'}
        ${['file:///a/b/', '../../c']}   | ${'file:///c'}
        ${['file:///a/b/', '.././c']}    | ${'file:///a/c'}
        ${['file:///a/b/', '/c']}        | ${'file:///c'}
        ${['file:///a/b/', 'http://c']}  | ${'http://c/'}
        ${['http://a/b', '//c/d']}       | ${'http://c/d'}    // authority change replaces authority+path
        ${['foo://a/b', 'bar:']}         | ${'bar:'}          // scheme change replaces scheme+authority+path
        ${['foo:/a/b/.']}                | ${'foo:/a/b/'}
        ${['foo:a/b/.']}                 | ${'foo:a/b/.'}

    `("resolveUri($input)", ({ input: [base, ...parts], expected }) => {
        const baseUri = Uri.parse(base, /*strict*/ true);
        const actual = resolveUri(baseUri, ...parts);
        expect(actual.toString(/*skipEncoding*/ true)).toBe(expected);
    });
});