// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from "fs";
import { Uri } from "vscode";
import { getCanonicalUri } from "../canonicalPaths";
jest.mock("fs");

describe("canonicalPaths", () => {
    describe("getCanonicalUri", () => {
        it.each`
            uri                         | expected
            ${`https://foo/bar`}        | ${`https://foo/bar`}
            ${`https://foo/bar/../baz`} | ${`https://foo/baz`}
            ${`foo:bar`}                | ${`foo:bar`}
            ${`foo:/bar/../baz`}        | ${`foo:/baz`}
        `("for non-file URI: $uri", ({ uri: uriString, expected }) => {
            const uri = Uri.parse(uriString, /*strict*/ true);
            const canonicalUri = getCanonicalUri(uri);
            expect(canonicalUri.toString(/*skipEncoding*/ true)).toBe(expected);
        });

        it("for file URI when exists", () => {
            jest.resetAllMocks();
            const realpathNative = fs.realpathSync.native as jest.MockedFn<typeof fs.realpathSync.native>;
            realpathNative.mockImplementationOnce(file => {
                if (file.toString().replaceAll("\\", "/") === "/a/b/../C") return "/a/c";
                throw new Error();
            });

            const canonicalUri = getCanonicalUri(Uri.file("/a/b/../C"));
            expect(realpathNative).toHaveBeenCalledTimes(1);
            expect(canonicalUri.toString(/*skipEncoding*/ true)).toBe("file:///a/c");
        });

        it("for file URI when not exists", () => {
            jest.resetAllMocks();
            const realpathNative = fs.realpathSync.native as jest.MockedFn<typeof fs.realpathSync.native>;
            realpathNative.mockImplementationOnce(() => { throw new Error(); });

            const canonicalUri = getCanonicalUri(Uri.file("/a/b/../C"));
            expect(realpathNative).toHaveBeenCalledTimes(1);
            expect(canonicalUri.toString(/*skipEncoding*/ true)).toBe("file:///a/C");
        });
    });
});