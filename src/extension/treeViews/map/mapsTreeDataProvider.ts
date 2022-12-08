// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import * as constants from "../../constants";
import type { LogFile } from "../../model/logFile";
import { MapId, MapReference } from "../../model/mapEntry";
import { BaseNodeProvider } from "../common/baseNodeProvider";
import { PageNode } from "../common/pageNode";
import { MapConstructorKey, MapConstructorNode, MapConstructorNodeBuilder, MapConstructorNodeEntries } from "./mapConstructorNode";
import { MapFileNodeEntries } from "./mapFileNode";
import { MapFunctionNodeEntries } from "./mapFunctionNode";
import { MapNodeBuilder, MapNodeEntries } from "./mapNode";

const MAPS_PAGE_SIZE = 500;

/**
 * Provides conceptual tree nodes for v8 "maps" discovered in the log file.
 */
export class MapsTreeDataProvider extends BaseNodeProvider {
    private _sortBy = constants.kDefaultMapSortMode;
    private _groupBy = constants.kDefaultGroupMaps;
    private _filter = constants.kDefaultShowMaps;
    private _log?: LogFile;
    private _maps?: MapReference[];

    constructor() {
        super(() => {
            if (this._log) {
                if (!this._maps) {
                    const showUnreferenced = this._filter.includes(constants.ShowMaps.Unreferenced);
                    const showNonUserCode = this._filter.includes(constants.ShowMaps.NonUserCode);
                    const showTransitions = this._filter.includes(constants.ShowMaps.Transitions);
                    this._maps = from(this._log.maps)
                        .through(q => showUnreferenced ? q : q.where(([, map]) => map.isReferencedByIC()))
                        .through(q => showNonUserCode ? q : q.where(([, map]) => !map.isNonUserCode()))
                        .through(q => showTransitions ? q : q.where(([, map]) => !map.isIntermediateTransition()))
                        .select(([mapId, map]) => MapReference.fromMapId(mapId, map))
                        .toArray();
                }
                return this.applyGroupAndSort(this._maps);
            }
            return [];
        }, { pageSize: MAPS_PAGE_SIZE });
    }

    get sortBy() { return this._sortBy; }
    set sortBy(value) {
        if (this._sortBy !== value) {
            this._sortBy = value;
            this.invalidate();
        }
    }

    get filter() { return this._filter; }
    set filter(value) {
        if (this._filter !== value) {
            this._filter = value;
            this._maps = undefined;
            this.invalidate();
        }
    }

    get groupBy() { return this._groupBy; }
    set groupBy(value) {
        if (this._groupBy !== value) {
            this._groupBy = value;
            this.invalidate();
        }
    }

    get log() { return this._log; }
    set log(value) {
        if (this._log !== value) {
            this._log = value;
            this._maps = undefined;
            this.invalidate();
        }
    }

    /**
     * Finds the conceptual map node corresponding to the provided address.
     */
    async findNode(mapId: MapId) {
        if (this._log?.maps.has(mapId)) {
            const rootNodes = await this.rootNodes;
            if (rootNodes) {
                for (const root of rootNodes) {
                    if (root instanceof MapConstructorNode) {
                        const descendant = await root.findNode(mapId);
                        if (descendant) return descendant;
                    }
                    if (root instanceof PageNode) {
                        for (const pagedNode of root.page) {
                            if (pagedNode instanceof MapConstructorNode) {
                                const descendant = await pagedNode.findNode(mapId);
                                if (descendant) return descendant;
                            }
                        }
                    }
                }
            }
        }
    }

    private groupIntoFunctions(entries: MapNodeEntries) {
        return entries.groupIntoFunctions();
    }

    private groupIntoFiles(entries: MapNodeEntries | MapFunctionNodeEntries) {
        return entries.groupIntoFiles();
    }

    private applyGroupAndSort(maps: MapReference[]) {
        const groupByFile = this.groupBy.includes(constants.GroupMaps.ByFile);
        const groupByFunction = this.groupBy.includes(constants.GroupMaps.ByFunction);

        // collect constructors by name that have more than one entry with the same name (i.e., across different files).
        const ambiguousGroups = from(maps)
            .select(({ map }) => [map.constructorName, map.constructorEntry] as const)
            .where(([constructorName]) => !!constructorName)
            .groupBy(([constructorName]) => constructorName, ([, constructorEntry]) => constructorEntry, (name, group) => [name, from(group).distinct().toArray()] as const)
            .where(([, constructorEntries]) => constructorEntries.length > 1)
            .toMap(([constructorName]) => constructorName, ([, constructorEntries]) => constructorEntries);

        const entries = new MapConstructorNodeEntries(
            from(maps)
            .groupBy(
                ({ map }) => new MapConstructorKey(
                    map.constructorName,
                    map.constructorEntry,
                    map.mapType,
                    ambiguousGroups.get(map.constructorName)?.indexOf(map.constructorEntry)),
                ({ mapId, map }) => new MapNodeBuilder(mapId, map),
                (key, group) => {
                    let entries: MapNodeEntries | MapFunctionNodeEntries | MapFileNodeEntries = new MapNodeEntries(group.toArray());
                    if (groupByFunction) entries = this.groupIntoFunctions(entries);
                    if (groupByFile) entries = this.groupIntoFiles(entries);
                    return new MapConstructorNodeBuilder(key, entries);
                },
                MapConstructorKey.equaler)
            .toArray());

        return entries.buildAll(this, /*parent*/ undefined);
    }
}
