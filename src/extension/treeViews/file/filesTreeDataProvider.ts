// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import { StringMap } from "#core/collections/stringMap.js";
import type { DeoptEntry } from "#deoptigate/deoptEntry.js";
import type { FunctionEntry } from "#deoptigate/functionEntry.js";
import type { IcEntry } from "#deoptigate/icEntry.js";
import type { Uri } from "vscode";
import type { Entry } from "../../model/entry";
import type { LogFile } from "../../model/logFile";
import { getCanonicalUri } from "../../services/canonicalPaths";
import { BaseNodeProvider } from "../common/baseNodeProvider";
import type { DeoptEntryNode } from "./deopt/deoptEntryNode";
import { FileNode } from "./fileNode";
import type { FunctionEntryNode } from "./function/functionEntryNode";
import type { IcEntryNode } from "./ic/icEntryNode";

/**
 * A conceptual tree node provider for a log file.
 */
export class FilesTreeDataProvider extends BaseNodeProvider {
    /**
     * The file nodes in the current log, keyed by canonical path.
     */
    readonly fileNodes = new StringMap<Uri, FileNode>(uriToString);

    /**
     * The function entry nodes in the current log, keyed by function entry.
     */
    readonly functionNodes = new Map<FunctionEntry, FunctionEntryNode>();

    /**
     * The deopt entry nodes in the current log, keyed by deopt entry.
     */
    readonly deoptNodes = new Map<DeoptEntry, DeoptEntryNode>();

    /**
     * The ic entry nodes in the current log, keyed by ic entry.
     */
    readonly icNodes = new Map<IcEntry, IcEntryNode>();

    /**
     * Opens a `LogFile` for the provided `uri`.
     */
    openLog(uri: Uri, log: LogFile) {
        const commonBase = log.commonBaseDirectory;
        this.setRoots(
            from(log.files)
            .map(([file, entries]) => new FileNode(this, log, getCanonicalUri(file), entries, commonBase))
            .orderBy(({ file }) => file.path.endsWith(".js") ? 0 : 1)
            .thenBy(({ file }) => file)
            .toArray()
        );
    }

    /**
     * Closes the current `LogFile`.
     */
    closeLog() {
        this.setRoots(undefined);
    }

    /**
     * Finds the conceptual tree node corresponding to the provided entry.
     */
    async findNode(entry: Entry) {
        const fileNode = entry.filePosition && this.fileNodes.get(entry.filePosition.uri);
        if (!fileNode) return;
        return await fileNode.findNode(entry);
    }

    protected invalidate() {
        super.invalidate();
        this.fileNodes.clear();
        this.functionNodes.clear();
        this.deoptNodes.clear();
        this.icNodes.clear();
    }
}

function uriToString(x: Uri) {
    return x.toString();
}