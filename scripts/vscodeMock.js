const { URI, Utils } = require("vscode-uri");

/**
 * @returns {x is object}
 */
function isObject(x) { return typeof x === "object" && x !== null || typeof x === "function"; }

class Position {
    /** @type {number} */ line;
    /** @type {number} */ character;
    /**
     * @param {number} line
     * @param {number} character
     */
    constructor(line, character) {
        if (!Number.isInteger(line) || line < 0) throw new Error();
        if (!Number.isInteger(character) || character < 0) throw new Error();
        this.line = line;
        this.character = character;
        Object.freeze(this);
    }

    /**
     * @param {Position} other
     */
    isBefore(other) { return this.compareTo(other) < 0; }
    /**
     * @param {Position} other
     */
    isBeforeOrEqual(other) { return this.compareTo(other) <= 0; }
    /**
     * @param {Position} other
     */
    isAfter(other) { return this.compareTo(other) > 0; }
    /**
     * @param {Position} other
     */
    isAfterOrEqual(other) { return this.compareTo(other) >= 0; }
    /**
     * @param {Position} other
     */
    isEqual(other) { return this === other || this.compareTo(other) === 0; }
    /**
     * @param {Position} other
     */
    compareTo(other) {
        const x = this.line - other.line;
        if (x) return Math.sign(x);
        return Math.sign(this.character - other.character);
    }
    /**
     * @overload
     * @param {number} [lineDelta]
     * @param {number} [characterDelta]
     * @overload
     * @param {{ lineDelta?: number, characterDelta?: number }} change
     */
    translate(lineDelta = undefined, characterDelta = undefined) {
        const change = isObject(lineDelta) ? lineDelta : { lineDelta, characterDelta };
        lineDelta = change.lineDelta ?? 0;
        characterDelta = change.characterDelta ?? 0;
        return this.with(Math.max(0, this.line + lineDelta), Math.max(0, this.character + characterDelta));
    }
    /**
     * @overload
     * @param {number} [line]
     * @param {number} [character]
     * @overload
     * @param {{ line?: number, character?: number }} change
     */
    with(line = undefined, character = undefined) {
        const change = isObject(line) ? line : { line, character };
        line = change.line ?? this.line;
        character = change.character ?? this.character;
        return line === this.line && character === this.character ? this : new Position(line, character);
    }
}

exports.Position = Position;

class Range {
    /** @type {Position} */ start;
    /** @type {Position} */ end;
    /**
     * @overload
     * @param {Position} start
     * @param {Position} end
     * @overload
     * @param {number} startLine
     * @param {number} startCharacter
     * @param {number} endLine
     * @param {number} endCharacter
     */
    constructor(startLine, startCharacter, endLine, endCharacter) {
        const start = startLine instanceof Position ? startLine : new Position(startLine, startCharacter);
        const end = startCharacter instanceof Position ? startCharacter : new Position(endLine, endCharacter);
        if (start.isAfter(end)) {
            this.start = end;
            this.end = start;
        }
        else {
            this.start = start;
            this.end = end;
        }
    }
    get isEmpty() { return this.start.isEqual(this.end); }
    get isSingleLine() { return this.start.line === this.end.line; }
    /**
     * @param {Position | Range} positionOrRange
     */
    contains(positionOrRange) {
        return positionOrRange instanceof Position ?
            this.start.isBeforeOrEqual(positionOrRange) && this.end.isAfterOrEqual(positionOrRange) :
            this.start.isBeforeOrEqual(positionOrRange.start) && this.end.isAfterOrEqual(positionOrRange.end);
    }
    /**
     * @param {Range} other
     */
    isEqual(other) { return this.start.isEqual(other.start) && this.end.isEqual(other.end); }
    /**
     * @param {Range} range
     * @returns {Range | undefined}
     */
    intersection(range) {
        if (this.start.isAfter(range.end) ||
            this.end.isBefore(range.start)) {
            return undefined;
        }
        return this.with(
            this.start.isAfterOrEqual(other.start) ? this.start : other.start,
            this.end.isBeforeOrEqual(other.end) ? this.end : other.end,
        );
    }
    /**
     * @param {Range} other
     */
    union(other) {
        return this.with(
            this.start.isBeforeOrEqual(other.start) ? this.start : other.start,
            this.end.isAfterOrEqual(other.end) ? this.end : other.end,
        );
    }
    /**
     * @overload
     * @param {Position} [start]
     * @param {Position} [end]
     * @overload
     * @param {{ start?: Position; end?: Position }} change
     */
    with(start = undefined, end = undefined) {
        const change = isObject(start) ? start : { start, end };
        start = change.start ?? this.start;
        end = change.end ?? this.end;
        if (!(start instanceof Position)) throw new TypeError();
        if (!(end instanceof Position)) throw new TypeError();
        return this.start.isEqual(start) && this.end.isEqual(end) ? this : new Range(start, end);
    }
}

exports.Range = Range;

class Uri {
    /** @type {URI} */ #uri;
    /**
     * @private
     * @param {URI} uri
     */
    constructor(uri) {
        this.#uri = uri;
    }
    get scheme() { return this.#uri.scheme; }
    get authority() { return this.#uri.authority; }
    get path() { return this.#uri.path; }
    get query() { return this.#uri.query; }
    get fragment() { return this.#uri.fragment; }
    get fsPath() { return this.#uri.fsPath; }
    /**
     * @param {string} value
     * @param {boolean} [strict]
     */
    static parse(value, strict) { return new Uri(URI.parse(value, strict)); }
    /**
     * @param {string} path
     */
    static file(path) { return new Uri(URI.file(path)); }
    /**
     * @param {Uri} base
     * @param  {...string} pathSegments
     */
    static joinPath(base, ...pathSegments) { return new Uri(Utils.joinPath(base.#uri, ...pathSegments)); }
    /**
     * @param {{ readonly scheme: string; readonly authority?: string; readonly path?: string; readonly query?: string; readonly fragment?: string }} components
     */
    static from(components) { return new Uri(URI.from(components)); }
    /**
     * @param {{ scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }} change
     */
    with(change) {
        const uri = this.#uri.with(change);
        if (uri === this.#uri) return this;
        return this.#uri.scheme === uri.scheme &&
            this.#uri.authority === uri.authority &&
            this.#uri.path === uri.path &&
            this.#uri.query === uri.query &&
            this.#uri.fragment === uri.fragment ? this : new Uri(uri);
    }
    /**
     * @param {boolean} [skipEncoding]
     */
    toString(skipEncoding) { return this.#uri.toString(skipEncoding); }
    toJSON() { return this.#uri.toJSON(); }
}

exports.Uri = Uri;

class Location {
    /** @type {Uri} */ uri;
    /** @type {Range} */ range;
    /**
     * @param {Uri} uri
     * @param {Range | Position} rangeOrPosition
     */
    constructor(uri, rangeOrPosition) {
        if (!uri) throw new TypeError();
        if (!rangeOrPosition) throw new TypeError();
        this.uri = uri;
        this.range = rangeOrPosition instanceof Range ? rangeOrPosition : new Range(rangeOrPosition, rangeOrPosition);
    }
}

exports.Location = Location;
