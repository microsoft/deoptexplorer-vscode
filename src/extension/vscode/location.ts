// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Comparer, Equaler } from "@esfx/equatable";
import { ref } from "@esfx/ref";
import { markdown } from "#core/markdown.js";
import { KnownSerializedType, RegisteredSerializer, registerKnownSerializer } from "#core/serializer.js";
import { Sources } from "#core/sources.js";
import { UriComparer, UriEqualer, uriExtname, UriSerializer } from "#core/uri.js";
import { compareNullable, equateNullable, hashNullable } from "#core/utils.js";
import { Location, Position, Uri } from "vscode";
import { getScriptSourceLocation } from "../fileSystemProviders/scriptSourceFileSystemProvider";
import { formatRange, RangeComparer, RangeEqualer, RangeSerializer, tryParseTrailingRange } from "./range";
import { formatUri, FormatUriOptions, isPathOrUriString, pathOrUriStringToUri, UNKNOWN_URI } from "./uri";

export const UNKNOWN_LOCATION = new Location(UNKNOWN_URI, new Position(0, 0));

/**
 * Parses {@link text} as a {@link Location}.
 * @param text The text to parse
 * @param strict When `true`, the {@link text} must be a URI. When `false` or not specified, absolute paths like `/foo` or `C:\foo` are
 * converted to a URI via {@link Uri.file}.
 */
export function parseLocation(text: string, strict?: boolean) {
    const out_prefixLength = ref.out<number>();
    const range = tryParseTrailingRange(text, out_prefixLength);
    if (range) {
        const uriString = text.slice(0, out_prefixLength.value);
        const uri =
            strict ? Uri.parse(uriString, /*strict*/ true) : 
            isPathOrUriString(uriString) ? pathOrUriStringToUri(uriString) :
            UNKNOWN_URI.with({ path: encodeURIComponent(uriString) });
        return new Location(uri, range);
    }

    const uri =
        strict ? Uri.parse(text, /*strict*/ true) :
        isPathOrUriString(text) ? pathOrUriStringToUri(text) :
        UNKNOWN_URI.with({ path: encodeURIComponent(text) });
    return new Location(uri, new Position(0, 0));
}

export interface FormatLocationOptions extends FormatUriOptions {
    /**
     * Indicates how the range should be formatted (default `"position-or-range"`):
     *
     * - `"none"` - Do not include the range.
     * - `"line"` - Only write the line number from of the {@link Range.start}.
     * - `"position"` - Only write the line and character of the {@link Range.start}.
     * - `"range"` - Write the line and character of both {@link Range.start} and {@link Range.end}.
     * - `"position-or-range"` - If the range is empty (i.e., {@link Range.start} and {@link Range.end} are the same), acts like `"position"`; otherwise, acts like `"range"`.
     */
    include?: "none" | "line" | "position" | "position-or-range" | "range";
}

/**
 * Formats a {@link Location} as a string.
 * @param location The {@link Location} to format.
 */
export function formatLocation(location: Location | undefined, { as = "uri", skipEncoding, include = "position-or-range", relativeTo }: FormatLocationOptions = { }) {
    if (!location) return "";
    let text = formatUri(location.uri, { as, skipEncoding, relativeTo });
    if (include !== "none") {
        const extname = uriExtname(location.uri);
        if (!(/^\.?(exe|dll|so|dylib)$/i.test(extname) && location.range.isEmpty && location.range.start.line === 0 && location.range.start.character === 0)) {
            text += formatRange(location.range, { include, prefix: true });
        }
    }
    return text;
}

export interface FormatLocationMarkdownOptions extends FormatUriOptions {
    trusted?: boolean;
    include?: FormatLocationOptions["include"] | { label?: FormatLocationOptions["include"], link?: FormatLocationOptions["include"], title?: FormatLocationOptions["include"] }
    label?: string;
    title?: string;
    schemes?: { allow?: string[], deny?: string[] };
    linkSources?: Sources;
}

const defaultSchemes = { deny: ["node"] };

export function formatLocationMarkdown(location: Location | undefined, { as = "uri", skipEncoding, relativeTo, include = "position-or-range", trusted = false, label, title, schemes = defaultSchemes, linkSources }: FormatLocationMarkdownOptions = { }) {
    const md = trusted ? markdown.trusted : markdown;
    if (!location) {
        return md``;
    }

    const labelInclude = typeof include === "object" ? include.label ?? "position-or-range" : include;
    label ??= formatLocation(location, { as, skipEncoding, include: labelInclude, relativeTo });
    if (schemes.deny?.includes(location.uri.scheme) || schemes.allow && !schemes.allow.includes(location.uri.scheme)) {
        return md`${label}`;
    }

    const linkLocation = linkSources ? getScriptSourceLocation(location, linkSources) : location;
    if (!linkLocation) {
        return md`${label}`;
    }

    const linkInclude = typeof include === "object" ? include.link ?? labelInclude : include;
    const link = linkInclude === "none" ? formatLocation(linkLocation, { as: "uri", include: linkInclude }) :
        formatUri(linkLocation.uri.with({ fragment: formatRange(location.range, { include: linkInclude, delimiter: ",", prefix: false })}), { as: "uri" })

    const titleInclude = typeof include === "object" ? include.title ?? linkInclude : include;
    title ??= formatLocation(location, { as: "file", skipEncoding: true, include: titleInclude });
    return md`[${label}](${link}${title ? md` "${title}"` : ""})`;
}

/**
 * An object that can be used to test the equality between two {@link Location} objects.
 */
export const LocationEqualer: Equaler<Location> = Equaler.create(
    (x, y) => equateNullable(x.uri, y.uri, UriEqualer) && equateNullable(x.range, y.range, RangeEqualer),
    (x) => hashNullable(x.uri, UriEqualer) ^ hashNullable(x.range, RangeEqualer)
);

/**
 * An object that can be used to perform a relational comparison between two {@link Location} objects.
 */
export const LocationComparer: Comparer<Location> = Comparer.create(
    (x, y) => compareNullable(x.uri, y.uri, UriComparer) || compareNullable(x.range, y.range, RangeComparer)
);

export const LocationSerializer = registerKnownSerializer("Location", {
    canSerialize: obj => obj instanceof Location,
    canDeserialize: obj => obj.$type === "Location",
    serialize: (obj, serialize) => ({
        $type: "Location",
        uri: UriSerializer.serialize(obj.uri, serialize),
        range: RangeSerializer.serialize(obj.range, serialize)
    }),
    deserialize: (obj, deserialize) => new Location(
        UriSerializer.deserialize(obj.uri, deserialize),
        RangeSerializer.deserialize(obj.range, deserialize)
    ),
    builtin: true
});

declare global { interface KnownSerializers {
    Location: RegisteredSerializer<Location, { $type: "Location", uri: KnownSerializedType<"Uri">, range: KnownSerializedType<"Range"> }>;
} }

