// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Uri } from "vscode";
import { assert } from "./assert";
import { URL } from "url";
import { Disposable } from "@esfx/disposable";

interface CacheNode<T> {
    uri: string;
    value: T;
    next?: CacheNode<T>;
}

export class MruCache<T> {
    readonly maxSize: number;
    private _head: CacheNode<T> | undefined;
    private _size: number = 0;
    private _onRemove?: (value: T) => void;
    private _onDispose?: (value: T) => void;

    constructor(maxSize = 5, onRemove?: (value: T) => void, onDispose?: (value: T) => void) {
        this.maxSize = maxSize;
        this._onRemove = onRemove;
        this._onDispose = onDispose;
    }

    get size() { return this._size; }

    private getNode(uri: string, update: boolean) {
        for (let node = this._head, prev: CacheNode<T> | undefined; node; prev = node, node = node.next) {
            if (node.uri === uri) {
                if (update && node !== this._head) {
                    if (prev) {
                        prev.next = node.next;
                    }
                    node.next = this._head;
                    this._head = node;
                }
                return node;
            }
        }
    }

    get(uri: string | Uri | URL) {
        return this.getNode(uri.toString(), true)?.value;
    }

    set(uri: string | Uri | URL, value: T) {
        let node = this.getNode(uri.toString(), true);
        if (node) {
            (void 0, this._onRemove)?.(value);
            node.value = value;
        }
        else {
            this._head = { uri: uri.toString(), value, next: this._head };
            this._size++;
            this.trim();
        }
    }

    delete(uri: string | Uri | URL) {
        const uriString = uri.toString();
        for (let node = this._head, prev: CacheNode<T> | undefined; node; prev = node, node = node.next) {
            if (node.uri === uriString) {
                if (prev) {
                    prev.next = node.next;
                }
                else {
                    assert(node === this._head);
                    this._head = node.next;
                }
                (void 0, this._onRemove)?.(node.value);
                return true;
            }
        }
        return false;
    }

    dispose() {
        this._clear(true);
    }

    [Disposable.dispose]() {
        this._clear(true);
    }

    clear() {
        this._clear(false);
    }

    private _clear(disposing: boolean) {
        let head = this._head;
        this._head = undefined;
        this._size = 0;

        if (this._onRemove || (disposing && this._onDispose)) {
            for (let node = head; node; node = node.next) {
                (void 0, this._onRemove)?.(node.value);
                if (disposing) {
                    (void 0, this._onDispose)?.(node.value);
                }
            }
        }
    }

    forEachEntry(cb: (value: T, uri: string) => void) {
        for (let node = this._head; node; node = node.next) {
            cb(node.value, node.uri);
        }
    }

    private trim() {
        if (this._size >= this.maxSize) {
            for (let node = this._head, prev: CacheNode<T> | undefined; node; prev = node, node = node.next) {
                if (!node.next) {
                    if (prev) {
                        prev.next = undefined;
                    }
                    this._size--;
                    (void 0, this._onRemove)?.(node.value);
                    return;
                }
            }
        }
    }
}