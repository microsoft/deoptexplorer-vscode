// THIRD PARTY LICENSE NOTICE:
//
// Portions of this code are sourced from V8:
//
//  Copyright 2012 the V8 project authors. All rights reserved.
//  Use of this source code is governed by a BSD-style license that can be
//  found in the LICENSE.v8 file.

/**
 * Represents a timer event in a V8 Execution timeline
 */
export class TimerEvent {
    readonly ranges: { start: number, end: number }[] = [];

    constructor(
        readonly color: string,
        readonly pause: boolean,
        readonly threadId: number,
        readonly href?: string
    ) { }
}
