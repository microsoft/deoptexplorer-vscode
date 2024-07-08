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

import { Reference } from "@esfx/ref";
import { Address, toAddress } from "#core/address.js";
import { CodeEntry, DynamicCodeEntry, DynamicFuncCodeEntry, SharedFunctionCodeEntry } from "./codeentry";
import { SplayTree } from "./splaytree";

/**
 * Constructs a mapper that maps addresses into code entries.
 */
export class CodeMap {
    /**
     * The number of alignment bits in a page address.
     */
    static readonly PAGE_ALIGNMENT = 12;

    /**
     * Page size in bytes.
     */
    static readonly PAGE_SIZE = 1 << CodeMap.PAGE_ALIGNMENT;

    /**
     * Dynamic code entries. Used for JIT compiled code.
     */
    protected dynamics_ = new SplayTree<Address, DynamicCodeEntry | DynamicFuncCodeEntry | SharedFunctionCodeEntry>();

    /**
     * Name generator for entries having duplicate names.
     */
    protected dynamicsNameGen_ = new NameGenerator();

    /**
     * Static code entries. Used for statically compiled code.
     */
    protected statics_ = new SplayTree<Address, CodeEntry>();

    /**
     * Libraries entries. Used for the whole static code libraries.
     */
    protected libraries_ = new SplayTree<Address, CodeEntry>();

    /**
     * Map of memory pages occupied with static code.
     */
    protected pages_: number[] = [];

    /**
     * Adds a dynamic (i.e. moveable and discardable) code entry.
     *
     * @param start The starting address.
     * @param codeEntry Code entry object.
     */
    addCode(start: Address, codeEntry: DynamicCodeEntry | DynamicFuncCodeEntry | SharedFunctionCodeEntry) {
        this.deleteAllCoveredNodes_(this.dynamics_, start, start + toAddress(codeEntry.size));
        this.dynamics_.insert(start, codeEntry);
    }

    /**
     * Moves a dynamic code entry. Throws an exception if there is no dynamic
     * code entry with the specified starting address.
     *
     * @param from The starting address of the entry being moved.
     * @param to The destination address.
     */
    moveCode(from: Address, to: Address) {
        let removedNode = this.dynamics_.remove(from);
        if (!removedNode) throw new Error("Key not found");
        this.deleteAllCoveredNodes_(this.dynamics_, to, to + toAddress(removedNode.value.size));
        this.dynamics_.insert(to, removedNode.value);
    }

    /**
     * Discards a dynamic code entry. Throws an exception if there is no dynamic
     * code entry with the specified starting address.
     *
     * @param start The starting address of the entry being deleted.
     */
    deleteCode(start: Address) {
        this.dynamics_.remove(start);
    }

    /**
     * Adds a library entry.
     *
     * @param start The starting address.
     * @param codeEntry Code entry object.
     */
    addLibrary(start: Address, codeEntry: CodeEntry) {
        this.markPages_(start, start + toAddress(codeEntry.size));
        this.libraries_.insert(start, codeEntry);
    }

    /**
     * Adds a static code entry.
     *
     * @param start The starting address.
     * @param codeEntry Code entry object.
     */
    addStaticCode(start: Address, codeEntry: CodeEntry) {
        this.statics_.insert(start, codeEntry);
    }

    private markPages_(start: Address, end: Address) {
        for (let addr = start; addr <= end; addr += toAddress(CodeMap.PAGE_SIZE)) {
            this.pages_[Number(addr / toAddress(CodeMap.PAGE_SIZE)) | 0] = 1;
        }
    }

    private deleteAllCoveredNodes_(tree: SplayTree<Address, CodeEntry>, start: Address, end: Address) {
        let to_delete: Address[] = [];
        let addr: Address = end - toAddress(1);
        while (addr >= start) {
            let node = tree.findGreatestLessThan(addr);
            if (!node) break;
            let start2 = node.key, end2 = start2 + toAddress(node.value.size);
            if (start2 < end && start < end2) to_delete.push(start2);
            addr = start2 - toAddress(1);
        }
        for (let i = 0, l = to_delete.length; i < l; ++i) tree.remove(to_delete[i]);
    }

    private isAddressBelongsTo_(addr: Address, node: SplayTree.Node<Address, CodeEntry>) {
        return addr >= node.key && addr < (node.key + toAddress(node.value.size));
    }

    private findInTree_(tree: SplayTree<Address, CodeEntry>, addr: Address) {
        let node = tree.findGreatestLessThan(addr);
        return node && this.isAddressBelongsTo_(addr, node) ? node : null;
    }

    /**
     * Finds a code entry that contains the specified address. Both static and
     * dynamic code entries are considered. Returns the code entry and the offset
     * within the entry.
     *
     * @param addr Address.
     */
    findEntry(addr: Address, out_instruction_start?: Reference<Address>) {
        let pageAddr = Number(addr / toAddress(CodeMap.PAGE_SIZE)) | 0;
        if (pageAddr in this.pages_) {
            // Static code entries can contain "holes" of unnamed code.
            // In this case, the whole library is assigned to this address.
            let result = this.findInTree_(this.statics_, addr);
            if (!result) {
                result = this.findInTree_(this.libraries_, addr);
                if (!result) return null;
            }
            if (out_instruction_start) out_instruction_start.value = result.key;
            return result.value;
        }
        let min = this.dynamics_.findMin();
        let max = this.dynamics_.findMax();
        if (min !== null && max !== null && addr < (max.key + toAddress(max.value.size)) && addr >= min.key) {
            let dynaEntry = this.findInTree_(this.dynamics_, addr);
            if (dynaEntry == null) return null;
            // Dedupe entry name.
            let entry = dynaEntry.value;
            if (!entry["nameUpdated_"]) {
                entry.name = this.dynamicsNameGen_.getName(entry.name);
                entry["nameUpdated_"] = true;
            }
            if (out_instruction_start) out_instruction_start.value = dynaEntry.key;
            return entry;
        }
        return null;
    }

    /**
     * Returns a dynamic code entry using its starting address.
     *
     * @param {number} addr Address.
     */
    findDynamicEntryByStartAddress(addr: Address) {
        let node = this.dynamics_.find(addr);
        return node ? node.value : null;
    }

    /**
     * Returns an array of all dynamic code entries.
     */
    getAllDynamicEntries() {
        return this.dynamics_.exportValues();
    }

    /**
     * Returns an array of pairs of all dynamic code entries and their addresses.
     */
    getAllDynamicEntriesWithAddresses() {
        return this.dynamics_.exportKeysAndValues();
    }

    /**
     * Returns an array of all static code entries.
     */
    getAllStaticEntries() {
        return this.statics_.exportValues();
    }

    /**
     * Returns an array of pairs of all static code entries and their addresses.
     */
    getAllStaticEntriesWithAddresses() {
        return this.statics_.exportKeysAndValues();
    }

    /**
     * Returns an array of all libraries entries.
     */
    getAllLibrariesEntries() {
        return this.libraries_.exportValues();
    }
}

class NameGenerator {
    private knownNames_: Record<string, number> = Object.create(null);

    getName(name: string) {
        if (!(name in this.knownNames_)) {
            this.knownNames_[name] = 0;
            return name;
        }
        let count = ++this.knownNames_[name];
        return name + ' {' + count + '}';
    }
}
