import { Location, Position, Range, Uri } from "vscode";
import * as constants from "../../constants";
import { DeoptPosition } from "../deoptPosition";

const loc = (uri: string, line: number = 0, character: number = 0) =>
    new Location(Uri.parse(uri, /*strict*/ true), new Position(line, character));

describe("deoptPosition", () => {
    const assertPositionsEqual = (actual: Position, expected: Position) => {
        expect(actual.line).toBe(expected.line);
        expect(actual.character).toBe(expected.character);
    };
    const assertRangesEqual = (actual: Range, expected: Range) => {
        assertPositionsEqual(actual.start, expected.start);
        assertPositionsEqual(actual.end, expected.end);
    };
    const assertUrisEqual = (actual: Uri, expected: Uri) => {
        expect(actual.toString()).toBe(expected.toString());
    };
    const assertLocationsEqual = (actual: Location, expected: Location) => {
        assertUrisEqual(actual.uri, expected.uri);
        assertRangesEqual(actual.range, expected.range);
    };

    it.each`
        text                                              | location                                              | inlinedAt
        ${'<http://foo:1:1>'}                             | ${loc(`http://foo`, 0, 0)}                            | ${undefined}
        ${'<unknown:1:20>'}                               | ${loc(`${constants.schemes.unknown}:unknown`, 0, 19)} | ${undefined}
        ${`<foo+bar:baz>`}                                | ${loc(`foo+bar:baz`)}                                 | ${undefined}
        ${`<http://foo:1:1> inlined at <http://bar:2:1>`} | ${loc(`http://foo`, 0, 0)}                            | ${[loc(`http://bar`, 1, 0)]}
    `(`static parse($text)`, ({ text, location, inlinedAt }: { text: string, location: Location, inlinedAt: readonly Location[] | undefined}) => {
        const pos = DeoptPosition.parse(text);
        assertLocationsEqual(pos.filePosition, location);
        if (inlinedAt === undefined) {
            expect(pos.inlinedAt).toBeUndefined();
        }
        else {
            expect(pos.inlinedAt).toBeDefined();
            expect(pos.inlinedAt!.length).toBe(inlinedAt.length);
            for (let i = 0; i < inlinedAt.length; i++) {
                assertLocationsEqual(pos.inlinedAt![i], inlinedAt[i]);
            }
        }
    });
});