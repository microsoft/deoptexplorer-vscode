// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Uri } from "vscode";
import { resolveUri, splitUriPath } from "../uri";

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
        ${['file:///c%3a/foo/bar']}      | ${'file:///c:/foo/bar'}

    `("resolveUri($input)", ({ input: [base, ...parts], expected }) => {
        const baseUri = Uri.parse(base, /*strict*/ true);
        const actual = resolveUri(baseUri, ...parts);
        expect(actual.toString(/*skipEncoding*/ true)).toBe(expected);
    });

    it.each`

        input         | expected
        ${""}         | ${[""]}
        ${"/"}        | ${["/"]}
        ${"/a"}       | ${["/", "a"]}
        ${"/a/b"}     | ${["/", "a", "b"]}
        ${"/c:"}      | ${["/C:/"]}
        ${"/c:/"}     | ${["/C:/"]}
        ${"/c:/a"}    | ${["/C:/", "a"]}
        ${"/c|"}      | ${["/C:/"]}
        ${"/c|/"}     | ${["/C:/"]}
        ${"/c|/a"}    | ${["/C:/", "a"]}
        ${"/c%3a"}    | ${["/C:/"]}
        ${"/c%3a/"}   | ${["/C:/"]}
        ${"/c%3a/a"}  | ${["/C:/", "a"]}
        ${"/c%3A"}    | ${["/C:/"]}
        ${"/c%3A/"}   | ${["/C:/"]}
        ${"/c%3A/a"}  | ${["/C:/", "a"]}
        ${"/c%7c"}    | ${["/C:/"]}
        ${"/c%7c/"}   | ${["/C:/"]}
        ${"/c%7c/a"}  | ${["/C:/", "a"]}
        ${"/c%7C"}    | ${["/C:/"]}
        ${"/c%7C/"}   | ${["/C:/"]}
        ${"/c%7C/a"}  | ${["/C:/", "a"]}
        ${"c:"}       | ${["/C:/"]}
        ${"c:/"}      | ${["/C:/"]}
        ${"c:/a"}     | ${["/C:/", "a"]}

    `("splitUriPath($input)", ({ input, expected }) => {
        expect(splitUriPath(input)).toEqual(expected);
    });
});