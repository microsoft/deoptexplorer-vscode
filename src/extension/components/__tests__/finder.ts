import { from } from "@esfx/iter-query";
import { DeoptEntry } from "#deoptigate/deoptEntry.js";
import { Location, Position, Range, Uri } from "vscode";
import { Entry } from "../../model/entry";
import { CanonicalUri } from "../../services/canonicalPaths";
import { PositionComparer } from "../../vscode/position";
import { createFinder } from "../finder";

it.skip("finder", () => {
    const finder = createFinder(Uri.file("C:/dev") as CanonicalUri, from<Entry>([
            Object.assign(new DeoptEntry(
                undefined,
                "foo",
                new Location(Uri.file("C:/dev"), new Position(0, 0)),
            ), { referenceLocation: new Location(Uri.file("C:/dev"), new Range(new Position(1, 10), new Position(1, 20))) }),
            Object.assign(new DeoptEntry(
                undefined,
                "bar",
                new Location(Uri.file("C:/dev"), new Position(0, 0))
            ), { referenceLocation: new Location(Uri.file("C:/dev"), new Range(new Position(1, 10), new Position(1, 15))) }),
            Object.assign(new DeoptEntry(
                undefined,
                "baz",
                new Location(Uri.file("C:/dev"), new Position(0, 0))
            ), { referenceLocation: new Location(Uri.file("C:/dev"), new Range(new Position(1, 15), new Position(1, 20))) }),
            Object.assign(new DeoptEntry(
                undefined,
                "baz",
                new Location(Uri.file("C:/dev"), new Position(0, 0))
            ), { referenceLocation: new Location(Uri.file("C:/dev"), new Range(new Position(1, 21), new Position(1, 30))) }),
        ])
        .select(entry => ({ entry, referenceLocation: entry.pickReferenceLocation(Uri.file("C:/dev")) }))
        .orderBy(({ referenceLocation }) => referenceLocation.range.start, PositionComparer)
        .thenBy(({ referenceLocation }) => referenceLocation.range.end, PositionComparer)
        .toArray(({ entry }) => entry));

    const results = [...finder(new Position(1, 13))];
    expect(results.map(x => x.functionName)).toEqual(["bar", "foo"]);
});