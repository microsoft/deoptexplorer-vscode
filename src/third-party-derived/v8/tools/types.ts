// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
//
// THIRD PARTY LICENSE NOTICE:
//
// Portions of this code are sourced from V8:
//
//  Copyright 2012 the V8 project authors. All rights reserved.
//  Use of this source code is governed by a BSD-style license that can be
//  found in the LICENSE.v8 file.

import { TimeTicks } from "#core/time.js";
import { CanonicalUri } from "#extension/services/canonicalPaths.js";
import { Location, Position } from "vscode";
import { CallTreeNode } from "./calltree";

export class LineTick {
    constructor(
        /** A 1-based line number */
        readonly line: number,
        readonly hitCount: number,
    ) {
    }

    static fromRecord(lineTicks: Record<number, number> | undefined) {
        if (!lineTicks) return [];
        return Object.entries(lineTicks)
            .map(([line, count]) => new LineTick(+line, count))
            .sort((a, b) => a.line - b.line);
    }
}

export class FileLineTick extends LineTick {
    constructor(
        readonly file: CanonicalUri,
        line: number,
        hitCount: number
    ) {
        super(line, hitCount);
    }

    toLocation() {
        // NOTE: LineTick.line is 1-based, Position is 0-based.
        return new Location(this.file, new Position(this.line - 1, 0));
    }
}

export class SampleInfo {
    constructor(
        public node: CallTreeNode,
        public timestamp: TimeTicks,
        public line: number,
    ) {
    }
}

export interface JsonProfile {
    nodes: JsonProfileNode[];
    startTime: number;
    endTime: number;
    samples?: number[];
    timeDeltas?: number[];
}

export interface JsonProfileNode {
    id: number;
    callFrame: JsonProfileCallFrame;
    hitCount?: number;
    children?: number[];
    deoptReason?: string;
    positionTicks?: JsonProfilePositionTickInfo[];
}

export interface JsonProfileCallFrame {
    functionName: string;
    scriptId: string;
    url: string;
    lineNumber: number;
    columnNumber: number;
}

export interface JsonProfilePositionTickInfo {
    line: number;
    ticks: number;
}
