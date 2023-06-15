// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
//
// THIRD PARTY LICENSE NOTICE:
//
// Portions of this code are sourced from V8:
//
// Copyright 2009 the V8 project authors. All rights reserved.
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
//       copyright notice, this list of conditions and the following
//       disclaimer in the documentation and/or other materials provided
//       with the distribution.
//     * Neither the name of Google Inc. nor the names of its
//       contributors may be used to endorse or promote products derived
//       from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

import { CancelError } from "@esfx/cancelable";
import { Address, parseAddress } from "#core/address.js";
import { CancellationError, CancellationToken } from "vscode";
import { CsvParser } from "./csvparser";

// Parses dummy variable for readability;
export const parseInt32 = 'parse-int32';
export const parseString = 'parse-string';
export const parseVarArgs = 'parse-var-args';
export const commandNameArg = 'command-name-arg'
export const cancelTokenArg = 'cancel-token-arg';

/**
 * A complex field parser.
 */
export interface ParserObject {
    parser: ((s: string) => unknown) | typeof parseString | typeof parseInt32;
    optional?: boolean;
    rest?: boolean;
    default?: () => unknown;
}

export type Parser = ((s: string) => unknown) | typeof parseString | typeof parseInt32 | typeof parseVarArgs | typeof cancelTokenArg | typeof commandNameArg | ParserObject;

export type Parsers = readonly [] | readonly Parser[];

export interface Dispatcher {
    readonly parsers: Parsers;
    processor(...args: any[]): void | Promise<void>;
}

export type DispatchTable = Record<string, Dispatcher | null>;

export class LogReader {
    private dispatchTable_: DispatchTable;
    private timedRange_: boolean;
    private pairwiseTimedRange_: boolean;

    /**
     * Current line.
     */
    private lineNum_: number;

    /**
     * CSV lines parser.
     */
    private csvParser_: CsvParser;

    /**
     * Keeps track of whether we've seen a "current-time" tick yet.
     */
    private hasSeenTimerMarker_: boolean;

    /**
     * List of log lines seen since last "current-time" tick.
     */
    private logLinesSinceLastTimerMarker_: string[];

    /**
     * Base class for processing log files.
     *
     * @param dispatchTable A table used for parsing and processing log records.
     * @param timedRange Ignore ticks outside timed range.
     * @param pairwiseTimedRange Ignore ticks outside pairs of timer markers.
     */
    constructor(dispatchTable: DispatchTable, timedRange: boolean, pairwiseTimedRange: boolean) {
        this.dispatchTable_ = dispatchTable;
        this.timedRange_ = timedRange;
        this.pairwiseTimedRange_ = pairwiseTimedRange;
        if (pairwiseTimedRange) {
            this.timedRange_ = true;
        }
        this.lineNum_ = 0;
        this.csvParser_ = new CsvParser();
        this.hasSeenTimerMarker_ = false;
        this.logLinesSinceLastTimerMarker_ = [];
    }

    /**
     * Used for printing error messages.
     *
     * @param str Error message.
     */
    printError(str: string) {
        // Do nothing.
    }

    /**
     * Processes a portion of V8 profiler event log.
     *
     * @param chunk A portion of log.
     */
    async processLogChunk(chunk: string, token?: CancellationToken): Promise<void> {
        await this.processLog_(chunk.split('\n'), token);
    }

    /**
     * Processes a line of V8 profiler event log.
     *
     * @param line A line of log.
     */
    async processLogLine(line: string, token?: CancellationToken): Promise<void> {
        if (!this.timedRange_) {
            await this.processLogLine_(line, token);
            return;
        }
        if (line.startsWith("current-time")) {
            if (this.hasSeenTimerMarker_) {
                await this.processLog_(this.logLinesSinceLastTimerMarker_, token);
                this.logLinesSinceLastTimerMarker_ = [];
                // In pairwise mode, a "current-time" line ends the timed range.
                if (this.pairwiseTimedRange_) {
                    this.hasSeenTimerMarker_ = false;
                }
            } else {
                this.hasSeenTimerMarker_ = true;
            }
        } else {
            if (this.hasSeenTimerMarker_) {
                this.logLinesSinceLastTimerMarker_.push(line);
            } else if (!line.startsWith("tick")) {
                await this.processLogLine_(line, token);
            }
        }
    }

    /**
     * Processes stack record.
     *
     * @param pc Program counter.
     * @param func JS Function.
     * @param stack String representation of a stack.
     * @return Processed stack.
     */
    processStack(pc: Address, func: Address, stack: string[]): Address[] {
        const fullStack = func ? [pc, func] : [pc];
        let prevFrame = pc;
        for (let i = 0, n = stack.length; i < n; ++i) {
            const frame = stack[i];
            const firstChar = frame.charAt(0);
            if (firstChar == '+' || firstChar == '-') {
                // An offset from the previous frame.
                prevFrame += parseAddress(frame);
                fullStack.push(prevFrame);
                // Filter out possible 'overflow' string.
            } else if (firstChar != 'o') {
                fullStack.push(parseAddress(frame));
            } else {
                this.printError("dropping: " + frame);
            }
        }
        return fullStack;
    }

    /**
     * Returns whether a particular dispatch must be skipped.
     *
     * @param dispatch Dispatch record.
     * @return True if dispatch must be skipped.
     */
    skipDispatch(dispatch: Dispatcher): boolean {
        return false;
    }

    /**
     * Does a dispatch of a log record.
     *
     * @param fields Log record.
     */
    private async dispatchLogRow_(fields: string[], token: CancellationToken | undefined) {
        // Obtain the dispatch.
        const commandName = fields.shift();
        if (commandName === undefined) {
            return;
        }

        const dispatch = this.dispatchTable_[commandName];
        if (dispatch === undefined || dispatch === null || this.skipDispatch(dispatch)) {
            return;
        }

        // Parse fields.
        let parsedFields: unknown[] = [];
        let sawOptional = false;
        let sawVarArgs = false;
        for (let parserIndex = 0, fieldIndex = 0; parserIndex < dispatch.parsers.length; parserIndex++, fieldIndex++) {
            let parser = dispatch.parsers[parserIndex];
            let optional = false;
            let varArgs = false;
            let defaultValue: (() => unknown) | undefined;
            if (typeof parser === "object") {
                varArgs = !!parser.rest;
                optional = varArgs || !!parser.optional;
                defaultValue = parser.default;
                parser = parser.parser;
            }
            else if (parser === parseVarArgs) {
                parser = parseString;
                varArgs = true;
                optional = true;
            }
            else if (parser === commandNameArg) {
                parsedFields.push(commandName);
                fieldIndex--;
                continue;
            }
            else if (parser === cancelTokenArg) {
                parsedFields.push(token);
                fieldIndex--;
                continue;
            }

            if (varArgs) {
                sawVarArgs = true;
            }
            else if (sawVarArgs) {
                throw new Error(`Invalid field after a var-args/rest field: ${commandName}`);
            }

            if (optional) {
                sawOptional = true;
                if (!varArgs && fieldIndex >= fields.length) {
                    if (defaultValue) {
                        for (let j = parsedFields.length; j < fieldIndex; j++) {
                            parsedFields.push(undefined);
                        }
                        parsedFields.push(defaultValue());
                    }
                    continue;
                }
            }
            else if (fieldIndex >= fields.length) {
                throw new Error(`Missing expected field: ${commandName}`);
            }
            else if (sawOptional) {
                throw new Error(`Invalid non-optional field after an optional field: ${commandName}`);
            }

            if (!varArgs) {
                parsedFields.push(this.parseField_(fields[fieldIndex], parser));
            }
            else if (fieldIndex >= fields.length) {
                parsedFields.push([]);
            }
            else {
                const restFields = fields.slice(fieldIndex);
                const parsedRestFields: unknown[] = [];
                for (const field of restFields) {
                    parsedRestFields.push(this.parseField_(field, parser));
                }
                parsedFields.push(parsedRestFields);
            }
        }

        // Run the processor.
        return dispatch.processor.apply(this, parsedFields);
    }

    private parseField_(field: string, parser: ((s: string) => unknown) | typeof parseString | typeof parseInt32) {
        switch (parser) {
            case parseString: return field;
            case parseInt32: return parseInt(field, 10);
            default:
                if (typeof parser == "function") {
                    return parser(field);
                }
                else {
                    throw new Error("Invalid log field parser: " + parser);
                }
        }
    }

    /**
     * Processes log lines.
     *
     * @param lines Log lines.
     */
    private async processLog_(lines: string[], token: CancellationToken | undefined): Promise<void> {
        for (let i = 0, n = lines.length; i < n; ++i) {
            await this.processLogLine_(lines[i], token);
        }
    }

    /**
     * Processes a single log line.
     *
     * @param line log line
     */
    private async processLogLine_(line: string, token: CancellationToken | undefined): Promise<void> {
        if (line.length > 0) {
            if (token?.isCancellationRequested) {
                throw new CancellationError();
            }
            try {
                let fields = this.csvParser_.parseLine(line);
                await this.dispatchLogRow_(fields, token);
            }
            catch (e: any) {
                if (e instanceof CancellationError || e instanceof CancelError) {
                    throw e;
                }
                this.printError(`line ${this.lineNum_ + 1}: ${e.message || e}\n${e.stack}`);
            }
        }
        this.lineNum_++;
    }
}
