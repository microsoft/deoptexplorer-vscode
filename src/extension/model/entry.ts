// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assertNever } from "#core/assert.js";
import { Sources } from "#core/sources.js";
import { UriEqualer } from "#core/uri.js";
import { equateNullable } from "#core/utils.js";
import type { DeoptEntry } from "#deoptigate/deoptEntry.js";
import type { FunctionEntry } from "#deoptigate/functionEntry.js";
import type { IcEntry } from "#deoptigate/icEntry.js";
import { Location, Uri } from "vscode";

export type LocationKind = "source" | "generated";

export abstract class EntryBase {
    /**
     * Indicates whether we have resolved the location of the entry
     */
    private _hasResolvedLocations = false;

    /**
     * Stores a reference to the source files loaded by the log that created the entry
     */
    private _sources: Sources | undefined;

    private _filePosition: Location | undefined;
    private _generatedFilePosition?: Location;

    constructor(
        sources: Sources | undefined,
        filePosition: Location | undefined,
    ) {
        this._sources = sources;
        this._filePosition = filePosition;
    }

    /**
     * Gets a value indicating whether this entry is source-mapped.
     */
    get isSourceMapped() {
        return !!this.generatedFilePosition;
    }

    /**
     * Gets the location of the entry.
     * If an entry is source-mapped, this points to the location of the entry in the source file.
     * If an entry is not source-mapped, this points to the location of the entry reported by the log.
     */
    get filePosition() { return this._filePosition; }
    set filePosition(value) { this._filePosition = value; }

    /**
     * If an entry is source-mapped, this points to the location of the entry in the generated file as reported by the log.
     */
    get generatedFilePosition() { return this._generatedFilePosition; }
    set generatedFilePosition(value) { this._generatedFilePosition = value; }

    /**
     * Method used to handle resolution of locations and references for the entry.
     * This should be overridden by subclasses, but should not be called directly. Instead,
     * you should call {@link resolveLocations} instead.
     */
    protected onResolveLocations(): void {
    }

    /**
     * Resolves locations and references for the entry. Does nothing if locations have already been resolved.
     */
    protected resolveLocations() {
        if (!this._hasResolvedLocations) {
            this._hasResolvedLocations = true;
            this.onResolveLocations();
        }
    }

    hasLocation(kind: LocationKind) {
        return this.getLocation(kind) !== undefined;
    }

    getLocation(kind: LocationKind) {
        this.resolveLocations();
        if (kind === "source") return this.filePosition;
        if (kind === "generated") return this.generatedFilePosition;
        assertNever(kind);
    }

    getScript() {
        const location = this.getLocation("generated");
        if (location) {
            return this._sources?.getScript(location.uri);
        }
    }

    getScriptId() {
        const location = this.getLocation("generated");
        if (location) {
            return this._sources?.getScriptId(location.uri);
        }
    }

    getSourceText(kind: LocationKind) {
        const location = this.getLocation(kind);
        if (location) {
            return this._sources?.getExistingContent(location.uri);
        }
    }

    getLineMap(kind: LocationKind) {
        const location = this.getLocation(kind);
        if (location) {
            return this._sources?.getExistingLineMap(location.uri);
        }
    }

    getSourceMap() {
        const location = this.getLocation("generated");
        if (location) {
            const sourceMap = this._sources?.getExistingSourceMap(location.uri);
            return sourceMap === "no-sourcemap" ? undefined : sourceMap;
        }
    }

    getSourceFile(kind: LocationKind) {
        const location = this.getLocation(kind);
        if (location) {
            return this._sources?.getExistingSourceFile(location.uri);
        }
    }

    getLocationKind(file: Uri, exact?: false): LocationKind;
    getLocationKind(file: Uri, exact?: boolean): LocationKind | undefined;
    getLocationKind(file: Uri, exact?: boolean) {
        return equateNullable(this.filePosition?.uri, file, UriEqualer) ? "source" :
            equateNullable(this.generatedFilePosition?.uri, file, UriEqualer) ? "generated" :
            exact ? undefined :
            "source";
    }

    /**
     * Pick the location to use for this entry based on the provided uri.
     * If the uri points to a generated file, the generated location will be used.
     * If the uri points to a source file, the source location will be used.
     * Unless an exact match is requested, falls back to `filePosition`
     */
    pickLocation(file: Uri, exact?: boolean) {
        const kind = this.getLocationKind(file, exact);
        return kind !== undefined ? this.getLocation(kind) : undefined;
    }
}

export abstract class ReferenceableEntryBase extends EntryBase {
    private _referenceLocation?: Location;
    private _generatedReferenceLocation?: Location;

    constructor(sources: Sources | undefined, filePosition: Location) {
        super(sources, filePosition);
    }

    /**
     * Gets the location of the entry.
     * If an entry is source-mapped, this points to the location of the entry in the source file.
     * If an entry is not source-mapped, this points to the location of the entry reported by the log.
     */
    get filePosition() { return super.filePosition!; }
    set filePosition(value) { super.filePosition = value; }

    /**
     * When finding references to an entry, this points to the location of the entry's reference.
     * For instance, the range covering an identifier or operator.
     * If an entry is source-mapped, this points to the reference location of the entry in the source file.
     * If an entry is not source-mapped, this points to a reference location derived from the location of 
     * the entry reported by the log.
     */
    get referenceLocation() {
        this.resolveLocations();
        return this._referenceLocation;
    }
    set referenceLocation(value) {
        this._referenceLocation = value;
    }

    /**
     * When finding references to an entry, this points to the location of the entry's reference.
     * For instance, the range covering an identifier or operator.
     * If an entry is source-mapped, this points to the reference location of the entry in the generated file
     * as reported by the log.
     */
    get generatedReferenceLocation() {
        this.resolveLocations();
        return this._generatedReferenceLocation;
    }
    set generatedReferenceLocation(value) {
        this._generatedReferenceLocation = value;
    }

    getLocation(kind: "source"): Location;
    getLocation(kind: LocationKind): Location | undefined;
    getLocation(kind: LocationKind): Location | undefined {
        return super.getLocation(kind);
    }

    /**
     * Pick the location to use for this entry based on the provided uri.
     * If the uri points to a generated file, the generated location will be used.
     * If the uri points to a source file, the source location will be used.
     * Unless an exact match is requested, falls back to `filePosition`
     */
    pickLocation(uri: Uri, exact?: false): Location;
    pickLocation(uri: Uri, exact: true): Location | undefined;
    pickLocation(uri: Uri, exact?: boolean): Location | undefined;
    pickLocation(uri: Uri, exact?: boolean) {
        return super.pickLocation(uri, exact);
    }

    getReferenceLocation(kind: "source"): Location;
    getReferenceLocation(kind: LocationKind): Location | undefined;
    getReferenceLocation(kind: LocationKind): Location | undefined {
        switch (kind) {
            case "source": return this.referenceLocation ?? this.filePosition;
            case "generated": return this.generatedReferenceLocation ?? this.generatedFilePosition;
            default: assertNever(kind);
        }
    }

    /**
     * Pick the location to use for this entry when resolved as a reference, based on the provided uri.
     * If the uri points to a generated file, the generated location will be used.
     * If the uri points to a source file, the source location will be used.
     * Unless an exact match is requested, falls back to `filePosition`
     */
    pickReferenceLocation(uri: Uri, exact?: false): Location;
    pickReferenceLocation(uri: Uri, exact?: boolean): Location | undefined;
    pickReferenceLocation(uri: Uri, exact?: boolean) {
        const kind = this.getLocationKind(uri, exact);
        return kind !== undefined ? this.getReferenceLocation(kind) : undefined;
    }
}

export type Entry = FunctionEntry | IcEntry | DeoptEntry;
