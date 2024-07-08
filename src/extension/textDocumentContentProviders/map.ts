// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { isDefined } from "@esfx/fn";
import { from } from "@esfx/iter-query";
import { formatAddress } from "#core/address.js";
import { RangeMap } from "#core/collections/rangeMap.js";
import { StringSet } from "#core/collections/stringSet.js";
import { markdown } from "#core/markdown.js";
import { MruCache } from "#core/mruCache.js";
import { TextWriter } from "#core/textWriter.js";
import { TimeDelta, TimeTicks } from "#core/time.js";
import { FunctionEntry } from "#deoptigate/functionEntry.js";
import { MapEvent } from "#v8/enums/mapEvent.js";
import { CancellationToken, Definition, DefinitionLink, DefinitionProvider, Disposable, DocumentLink, DocumentLinkProvider, DocumentSelector, EventEmitter, ExtensionContext, languages, Location, Position, ProviderResult, Range, ReferenceContext, ReferenceProvider, TextDocument, TextDocumentContentProvider, Uri, ViewColumn, window, workspace } from "vscode";
import * as constants from "../constants";
import { getScriptSourceLocation, getScriptSourceUri } from "../fileSystemProviders/scriptSourceFileSystemProvider";
import { MapEntry, MapEntryUpdate, MapId, MapProperty, MapReference, SymbolName } from "../model/mapEntry";
import { openedLog } from "../services/currentLogFile";
import { events } from "../services/events";
import { typeSafeExecuteCommand } from "../vscode/commands";
import { formatLocation } from "../vscode/location";

const selector: DocumentSelector = { scheme: constants.schemes.map };

let provider: MapDocumentContentProvider;

interface MapDocument {
    text: string;
    links: DocumentLink[];
    references: RangeMap<MapId | MapReference>;
    /** Declaration at a range */
    declarations: RangeMap<MapId | MapReference | MapProperty>;
}

class MapDocumentContentProvider implements TextDocumentContentProvider, DefinitionProvider, ReferenceProvider, DocumentLinkProvider {
    private onDidChangeEvent = new EventEmitter<Uri>();
    onDidChange = this.onDidChangeEvent.event;

    private mapDocumentCache = new MruCache<MapDocument>(5);

    resetCache() {
        this.mapDocumentCache.clear();
    }

    private getDocumentContentAndLinks(uri: Uri): MapDocument | undefined {
        const mapId = getMapIdFromMapUri(uri);
        if (!mapId || !openedLog) {
            return undefined;
        }

        const map = openedLog.maps.get(mapId);
        if (!map) {
            return undefined;
        }

        const startTime = openedLog.profile.startTime;
        const documentLinks: DocumentLink[] = [];
        const references = new RangeMap<MapId | MapReference>();
        const declarations = new RangeMap<MapId | MapReference | MapProperty>();

        const thisMapRef = MapReference.fromMapId(mapId, map);
        let currentMapRef: MapReference | undefined = thisMapRef;

        const seen = new StringSet<MapId>(id => id.toString());
        const history: MapEntryUpdate[] = [];
        while (currentMapRef) {
            // NOTE: Shouldn't be circular, but just in case...
            if (seen.has(currentMapRef.mapId)) break;
            seen.add(currentMapRef.mapId);

            let nextMapRef: MapReference | undefined;
            for (let i = currentMapRef.map.updates.length - 1; i >= 0; i--) {
                const update = currentMapRef.map.updates[i];
                if (update.toMapId.address === currentMapRef.address &&
                    update.toMapId.index === currentMapRef.index &&
                    update.toMap === currentMapRef.map) {
                    history.unshift(update);
                    const nextMap = update.fromMap;
                    nextMapRef = nextMap && MapReference.fromMapId(update.fromMapId, nextMap);
                    break;
                }
            }

            currentMapRef = nextMapRef;
        }

        const writer = new TextWriter();
        writer.write("map");
        writer.write(" ");
        writer.write(formatMapName(mapId), range => { declarations.set(range, thisMapRef); });
        writer.write(" ");
        const constructorName = map.constructorName || map.mapType;
        const baseMap = resolveBaseMap(map);
        if (constructorName || baseMap) {
            writer.write("extends ");
            if (constructorName) {
                writer.write(constructorName);
            }
            if (baseMap) {
                if (constructorName) writer.write(", ");
                writer.write(formatMapName(baseMap.mapId), range => { references.set(range, baseMap); });
            }
            writer.write(" ");
        }
        writer.write("{");
        writer.writeLine();

        let lastSource: FunctionEntry | undefined;
        for (const prop of map.properties) {
            if (prop.source && prop.source !== lastSource) {
                const prefix = `// Added by ${prop.source.functionName ?? "(anonymous)"} (`;
                const link = formatLocation(prop.source.filePosition, { as: "file", include: "position" });
                const suffix = `):`;
                const line = writer.line;
                const start = 4 + prefix.length;
                const end = start + link.length;
                const range = new Range(line, start, line, end);
                const pos = prop.source.filePosition.range.start;
                writer.write(`    ${prefix}${link}${suffix}`);
                writer.writeLine();
                const uri = getScriptSourceUri(prop.source.filePosition.uri, openedLog?.sources);
                if (uri) {
                    documentLinks.push(new DocumentLink(range, uri.with({ fragment: `${pos.line + 1},${pos.character + 1}` })));
                }
                lastSource = prop.source;
            }

            const name = formatMapPropertyName(prop);
            writer.write("    ");
            if (prop.enumerable === false) writer.write('nonenumerable ');
            if (prop.configurable === false) writer.write('nonconfigurable ');
            if (prop.writable === false) writer.write('readonly ');
            writer.write(name, range => declarations.set(range, prop));
            writer.write(": ");
            writePropertyType(writer, prop, range => {
                if (prop.type instanceof MapId) {
                    references.set(range, prop.type);
                }
            });
            writer.write(";");
            writer.writeLine();
        }

        writer.write("}");
        writer.writeLine();
        writer.writeLine();
        writer.write("/*");
        writer.writeLine();
        writer.write(markdown.table(
            ["Timestamp", { text: "Event", align: "left" }, { text: "From", align: "left" }, { text: "To", align: "left" }, { text: "Reason", align: "left" }, { text: "Location", align: "left" }],
            from(history)
                .toArray(update => {
                    const reason = update.reason ? update.reason :
                        update.event === MapEvent.Transition && update.name instanceof SymbolName ? `Added property ${update.name}` :
                        update.event === MapEvent.Transition && update.name ? `Added property '${update.name}'` :
                        update.event === MapEvent.InitialMap ? `Map created` :
                        "";
                    let location = "";
                    if (update.filePosition) {
                        location += `${update.functionName ?? "(anonymous)"} ${formatLocation(update.filePosition, { as: "file", include: "position" })}`;
                    }
                    return [
                        `${formatTimeRelativeTo(update.timestamp, startTime)}`,
                        update.event,
                        update.fromMapId.toString(),
                        update.toMapId.toString(),
                        reason,
                        {
                            text: location,
                            onWrite: (position) => {
                                if (update.filePosition) {
                                    const uri = getScriptSourceUri(update.filePosition.uri, openedLog?.sources);
                                    if (uri) {
                                        const line = writer.line + position.line;
                                        const start = position.character + (update.functionName?.length ?? 0) + 1;
                                        const end = start + formatLocation(update.filePosition, { as: "file", include: "position" }).length;
                                        const range = new Range(line, start, line, end);
                                        const pos = update.filePosition.range.start;
                                        documentLinks.push(new DocumentLink(range, uri.with({ fragment: `${pos.line + 1},${pos.character + 1}` })));
                                    }
                                }
                            }
                        }
                    ];
                }), { html: false }).toString());

        writer.write(map.details.trim());
        writer.writeLine();
        writer.write("*/");
        writer.writeLine();

        const doc: MapDocument = {
            text: writer.toString(),
            links: documentLinks,
            references,
            declarations
        };
        this.mapDocumentCache.set(uri, doc);
        return doc;
    }

    provideTextDocumentContent(uri: Uri, token: CancellationToken): ProviderResult<string> {
        return (this.mapDocumentCache.get(uri) ?? this.getDocumentContentAndLinks(uri))?.text;
    }

    private getMapReferenceAtLocation(document: TextDocument, position: Position) {
        if (!openedLog) return;

        // do nothing if we can't find a word
        const range = document.getWordRangeAtPosition(position);
        if (!range) return;

        // do nothing if we are in a comment
        const line = document.lineAt(range.start);
        const commentStart = line.text.indexOf("//");
        if (commentStart > -1 && range.start.character > commentStart) return;

        // do nothing if we fail to match an address
        const text = document.getText(range);
        const mapId = MapId.tryParse(text);
        if (!mapId) return;

        const map = openedLog.maps.get(mapId);
        return map && MapReference.fromMapId(mapId, map);
    }

    provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Definition | DefinitionLink[]> {
        const { references, declarations } = this.getDocumentContentAndLinks(document.uri) ?? {};
        const referencedEntries = references?.findAllContaining(position);
        if (referencedEntries) {
            return from(referencedEntries).map(([range, value]) =>
                value instanceof MapId ? new Location(getUriForMap(value), new Range(0, 0, 0, 0)) :
                value instanceof MapReference ? new Location(getUriForMap(value.mapId), new Range(0, 0, 0, 0)) :
                undefined
            ).filter(isDefined).toArray();
        }

        const declarationEntries = declarations?.findAllContaining(position);
        if (declarationEntries) {
            return from(declarationEntries).map(([range, value]) =>
                value instanceof MapId ? new Location(getUriForMap(value), new Range(0, 0, 0, 0)) :
                value instanceof MapReference ? new Location(getUriForMap(value.mapId), new Range(0, 0, 0, 0)) :
                value instanceof MapProperty && value.map ? new Location(getUriForMap(value.map.mapId), new Range(0, 0, 0, 0)) :
                undefined
            ).filter(isDefined).toArray();
        }

        const mapReference = this.getMapReferenceAtLocation(document, position);
        return mapReference && getReferenceLocationForMapName(mapReference.mapId);
    }

    provideReferences(document: TextDocument, position: Position, context: ReferenceContext, token: CancellationToken): ProviderResult<Location[]> {
        const mapReference = this.getMapReferenceAtLocation(document, position);
        if (!mapReference) return;

        const { mapId, map } = mapReference;
        const locations: Location[] = [];
        if (context.includeDeclaration) {
            locations.push(getReferenceLocationForMapName(mapId));
        }

        for (const ref of map.referencedBy) {
            if (ref.kind === "ic") {
                const location = getScriptSourceLocation(ref.entry.getReferenceLocation("source"), openedLog?.sources);
                if (location) locations.push(location);
            }
            else if (ref.kind === "property") {
                let location = getReferenceLocationForMapPropertyType(ref.property);
                if (location) location = getScriptSourceLocation(location, openedLog?.sources);
                if (location) locations.push(location);
            }
            else if (ref.kind === "map") {
                let location = getReferenceLocationForBaseMapInExtendsClause(mapId, ref.map);
                if (location) location = getScriptSourceLocation(location, openedLog?.sources);
                if (location) locations.push(location);
            }
        }

        return locations;
    }

    provideDocumentLinks(document: TextDocument, token: CancellationToken): ProviderResult<DocumentLink[]> {
        return (this.mapDocumentCache.get(document.uri) ?? this.getDocumentContentAndLinks(document.uri))?.links;
    }
}

function formatMapName(mapId: MapId) {
    return `${formatAddress(mapId.address)}${mapId.index ? `_${mapId.index}` : ""}`;
}

function formatMapPropertyName({ name }: MapProperty) {
    return name instanceof SymbolName ? name.toString() :
        /^\d+$/.test(name) ? name :
        /^[a-z$_][a-z$_\d]*$/i.test(name) ? name :
        JSON.stringify(name);
    // const symbolMatch =
    //     /^symbol\((?:\"((Symbol\.)?[^"]+)\" )?hash ([a-fA-F\d]+)\)/.exec(name) ??
    //     /^<Symbol: ([^>+])>/.exec(name);
    // return symbolMatch ? `[${symbolMatch[1] ? symbolMatch[1] : USE_TYPESCRIPT ? `Symbol(/* hash ${symbolMatch[3]} */)` : `symbol(hash ${symbolMatch[3]})`}]` :
    //     /^\d+$/.test(name) ? name :
    //     /^[a-z$_][a-z$_\d]*$/i.test(name) ? name :
    //     JSON.stringify(name);
}

function writePropertyType(writer: TextWriter, property: MapProperty, cb: (range: Range) => void) {
    if (typeof property.type === "string") {
        writer.write(property.type);
    }
    else if (property.type) {
        writer.write("map ");
        writer.write(formatMapName(property.type), cb);
    }
    else {
        writer.write("unknown");
    }
}

function formatMapPropertyType(property: MapProperty) {
    return typeof property.type === "string" ? property.type :
        property.type ? formatMapName(property.type) :
        "unknown";
}

function getReferenceLineStartOfMapProperty(property: MapProperty) {
    if (property.map) {
        const index = property.map.map.properties.indexOf(property);
        if (index > -1) {
            // count lines generated in the text document provider for maps
            let line = 1;                                                       //interface Map_0x... {
            for (let i = 0; i < index; i++) {
                line++;                                                         //    foo: heap;
            }

            if (property.enumerable === false) line++;                          //    @enumerable(false)
            if (property.configurable === false) line++;                        //    @configurable(false)
            return line;
        }
    }
}

function getCharacterStartOfMapPropertyName(property: MapProperty) {
    let pos = 4;                                                                //    ...
    if (property.enumerable === false) pos += 'nonenumerable '.length;      //    nonenumerable ...
    if (property.configurable === false) pos += 'nonconfigurable '.length;  //    nonconfigurable ...
    if (property.writable === false) pos += 'readonly '.length;                 //    readonly ...
    return pos;
}

function getCharacterEndOfMapPropertyName(property: MapProperty, start = getCharacterStartOfMapPropertyName(property)) {
    return start + formatMapPropertyName(property).length;
}

function getCharacterStartOfMapPropertyType(property: MapProperty) {
    return getCharacterEndOfMapPropertyName(property) + 2;                      //    name:
}

function getCharacterEndOfMapPropertyType(property: MapProperty, start: number) {
    return start + formatMapPropertyType(property).length;                      //          Map_0x0123456789
}

function getCharacterStartOfMapName() {
    return "map ".length;
}

function getCharacterEndOfMapName(mapId: MapId, start = getCharacterStartOfMapName()) {
    return start + mapId.toString().length;
}

function getCharacterStartOfBaseMapInExtendsClause({ mapId, map }: MapReference) {
    let pos = getCharacterEndOfMapName(mapId);
    pos += " extends ".length;
    const constructorType = map.constructorName || map.mapType;
    if (constructorType) {
        pos += constructorType.length + ", ".length;
    }
    return pos;
}

function getCharacterEndOfBaseMapInExtendsClause(mapId: MapId, start: number) {
    return start + formatMapName(mapId).length;
}

function getReferenceLocationForMapName(mapId: MapId) {
    const line = 0;
    const start = new Position(line, getCharacterStartOfMapName());
    const end = new Position(line, getCharacterEndOfMapName(mapId, start.character));
    return new Location(getUriForMap(mapId), new Range(start, end));
}

function getReferenceLocationForBaseMapInExtendsClause(mapId: MapId, mapRef: MapReference) {
    if (resolveBaseMap(mapRef.map)?.mapId.equals(mapId)) {
        const line = 0;
        const start = new Position(line, getCharacterStartOfBaseMapInExtendsClause(mapRef));
        const end = new Position(line, getCharacterEndOfBaseMapInExtendsClause(mapId, start.character));
        return new Location(getUriForMap(mapRef.mapId), new Range(start, end));
    }
}

function getReferenceLocationForMapPropertyName(property: MapProperty) {
    if (property.map) {
        const line = getReferenceLineStartOfMapProperty(property);
        if (line === undefined) return;
        const start = new Position(line, getCharacterStartOfMapPropertyName(property));
        const end = new Position(line, getCharacterEndOfMapPropertyName(property, start.character));
        return new Location(getUriForMap(property.map.mapId), new Range(start, end));
    }
}

function getReferenceLocationForMapPropertyType(property: MapProperty) {
    if (property.map) {
        const line = getReferenceLineStartOfMapProperty(property);
        if (line === undefined) return;
        const start = new Position(line, getCharacterStartOfMapPropertyType(property));
        const end = new Position(line, getCharacterEndOfMapPropertyType(property, start.character));
        return new Location(getUriForMap(property.map.mapId), new Range(start, end));
    }
}

function resolveBaseMap(map: MapEntry) {
    for (let base = map.baseMap; base; base = base.map.baseMap) {
        if (base.map.isReferencedByIC()) return base;
    }
}

export function getMapIdFromMapUri(uri: Uri) {
    if (uri.scheme === constants.schemes.map) {
        return MapId.parse(uri.path.replace(/\.v8-map$/g, ""));
    }
}

export function getUriForMap(mapId: MapId) {
    return Uri.parse(`${constants.schemes.map}:${mapId}${".v8-map"}`);
}

export async function showMap(mapId: MapId, viewColumn?: ViewColumn) {
    if (openedLog?.maps.has(mapId)) {
        const document = await workspace.openTextDocument(getUriForMap(mapId));
        await window.showTextDocument(document, { preview: false, preserveFocus: true, viewColumn });
    }
}

export async function showMapAsReference(mapIds: MapId[], uri: Uri, position: Position) {
    mapIds = mapIds.filter(mapId => !!openedLog?.maps.has(mapId));
    if (mapIds.length) {
        const openUri = getScriptSourceUri(uri, openedLog?.sources);
        if (openUri) {
            await typeSafeExecuteCommand("editor.action.showReferences", openUri, position, mapIds.map(mapId =>
                new Location(getUriForMap(mapId), new Position(0, 0))));
        }
    }
}

export function activateMapTextDocumentContentProvider(context: ExtensionContext) {
    provider = new MapDocumentContentProvider();
    return Disposable.from(
        workspace.registerTextDocumentContentProvider(constants.schemes.map, provider),
        languages.registerDefinitionProvider(selector, provider),
        languages.registerReferenceProvider(selector, provider),
        languages.registerDocumentLinkProvider(selector, provider),
        workspace.onDidOpenTextDocument(document => {
            if (document.uri.scheme === constants.schemes.map) {
                languages.setTextDocumentLanguage(document, "deoptexplorer-v8-map");
            }
        }),
        events.onDidCloseLogFile(() => provider.resetCache()),
        // window.onDidChangeActiveTextEditor(editor => {
        //     if (editor?.document.uri.scheme === constants.schemes.map && editor.viewColumn !== undefined) {
        //         const address = getAddressFromMapUri(editor.document.uri);
        //         if (address !== undefined) {
        //             emitters.willRevealMap({ address });
        //         }
        //     }
        // })
    );
}

const HOURS_PER_NANOSECOND = TimeDelta.fromHours(1).inNanoseconds();
const MINUTES_PER_NANOSECOND = TimeDelta.fromMinutes(1).inNanoseconds();
const SECONDS_PER_NANOSECOND = TimeDelta.fromSeconds(1).inNanoseconds();

function formatTimeRelativeTo(time: TimeTicks, startTime: TimeTicks) {
    let delta = time.subtract(startTime);
    let negative = false;
    if (delta.sign() < 0) {
        delta = delta.negate();
        negative = true;
    }
    let nanos = delta.inNanoseconds();
    const hours = nanos / HOURS_PER_NANOSECOND;
    nanos -= hours * HOURS_PER_NANOSECOND;
    const minutes = nanos / MINUTES_PER_NANOSECOND;
    nanos -= minutes * MINUTES_PER_NANOSECOND;
    const seconds = nanos / SECONDS_PER_NANOSECOND;
    nanos -= seconds * SECONDS_PER_NANOSECOND;
    const milliseconds = TimeDelta.fromNanoseconds(nanos).inSecondsF().toFixed(3).slice(1);
    return `${negative ? "-" : ""}${hours.toString(10).padStart(2, "0")}:${minutes.toString(10).padStart(2, "0")}:${seconds.toString(10).padStart(2, "0")}${milliseconds}`;
}