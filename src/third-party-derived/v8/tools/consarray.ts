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

/**
 * Constructs a ConsArray object. It is used mainly for tree traversal.
 * In this use case we have lots of arrays that we need to iterate
 * sequentally. The internal Array implementation is horribly slow
 * when concatenating on large (10K items) arrays due to memory copying.
 * That's why we avoid copying memory and insead build a linked list
 * of arrays to iterate through.
 */
export class ConsArray<T> {
    private tail_ = new Cell<T>(null!, null!);
    private currCell_: Cell<T> = this.tail_;
    private currCellPos_ = 0;

    /**
     * Concatenates another array for iterating. Empty arrays are ignored.
     * This operation can be safely performed during ongoing ConsArray
     * iteration.
     *
     * @param arr Array to concatenate.
     */
    concat(arr: readonly T[]) {
        if (arr.length > 0) {
            this.tail_.data = arr;
            this.tail_ = this.tail_.next = new Cell(null!, null!);
        }
    }

    /**
     * Whether the end of iteration is reached.
     */
    atEnd() {
        return this.currCell_ === null ||
            this.currCell_.data === null ||
            this.currCellPos_ >= this.currCell_.data.length;
    }

    /**
     * Returns the current item, moves to the next one.
     */
    next() {
        let result = this.currCell_.data[this.currCellPos_++];
        if (this.currCellPos_ >= this.currCell_.data.length) {
            this.currCell_ = this.currCell_.next;
            this.currCellPos_ = 0;
        }
        return result;
    }

    * values() {
        while (!this.atEnd()) {
            yield this.next();
        }
    }
}

/**
 * A cell object used for constructing a list in ConsArray.
 */
class Cell<T> {
    constructor(
        public data: readonly T[],
        public next: Cell<T>
    ) { }
}