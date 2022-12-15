// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Equaler } from "@esfx/equatable";
import { identity } from "@esfx/fn";
import { from, Query } from "@esfx/iter-query";
import { CancellationToken, ProviderResult, TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import { createTreeItem, TypeSafeTreeItemOptions } from "../createTreeItem";
import { BaseNode } from "./baseNode";
import { BaseNodeProvider } from "./baseNodeProvider";

export interface GroupingOptions<T extends BaseNode, K = any, C = any> {
    context?: (values: readonly T[], parent: GroupingNode<T> | undefined) => C,

    keyEqualer?: Equaler<K>;
    keySelector: (value: T, context: C) => K;

    label: Buildable<string | Uri, T, K, C>;
    description?: Buildable<TypeSafeTreeItemOptions["description"], T, K, C>;
    tooltip?: Buildable<TypeSafeTreeItemOptions["tooltip"], T, K, C>;
    iconPath?: Buildable<TypeSafeTreeItemOptions["iconPath"], T, K, C>;
    command?: Buildable<TypeSafeTreeItemOptions["command"], T, K, C>;
    contextValue?: Buildable<TypeSafeTreeItemOptions["contextValue"], T, K, C>;
    accessibilityInformation?: Buildable<TypeSafeTreeItemOptions["contextValue"], T, K, C>;

    pageSize?: number;
    sorter?: (query: Query<GroupingNode<T, K>>) => Iterable<GroupingNode<T, K>>,
}

type Buildable<V extends {} | null | undefined, T extends BaseNode, K, C> = V | ((key: K, elements: readonly T[], context: C) => V);

function build<V extends {} | null | undefined, T extends BaseNode, K, C>(value: Buildable<V, T, K, C>, key: K, elements: readonly T[], context: C) {
    return typeof value === "function" ? value(key, elements, context) : value;
}

export class GroupingNode<T extends BaseNode, K = any, C = any> extends BaseNode {
    constructor(
        provider: BaseNodeProvider,
        parent: BaseNode | undefined,
        readonly context: C,
        readonly key: K,
        readonly elements: readonly T[],
        readonly groupings: readonly GroupingOptions<T>[],
        readonly groupingIndex: number,
    ) {
        super(provider, parent, { pageSize: groupings[groupingIndex]?.pageSize });
    }

    get groupingOptions() {
        return this.groupings[this.groupingIndex];
    }

    protected override createTreeItem(): TreeItem {
        const options = this.groupings[this.groupingIndex];
        const context = this.context;
        const key = this.key;
        const elements = this.elements;
        return createTreeItem(build(options.label, key, elements, context), TreeItemCollapsibleState.Collapsed, {
            contextValue: build(options.contextValue, key, elements, context),
            description: build(options.description, key, elements, context),
            iconPath: build(options.iconPath, key, elements, context),
            command: build(options.command, key, elements, context),
            accessibilityInformation: build(options.accessibilityInformation, key, elements, context),
        });
    }

    override resolveTreeItem(treeItem: TreeItem, token: CancellationToken): ProviderResult<TreeItem> {
        const options = this.groupings[this.groupingIndex];
        treeItem.tooltip = build(options.tooltip, this.key, this.elements, this.context);
        return treeItem;
    }

    protected override getChildren(): Iterable<BaseNode> | Promise<Iterable<BaseNode>> {
        return GroupingNode._groupBy(
            this.elements,
            this.groupings,
            this.groupingIndex + 1,
            this
        );
    }

    private static _groupBy<T extends BaseNode, A extends readonly GroupingOptions<T>[] | []>(elements: readonly T[], groupings: A, groupingIndex: number, parent: GroupingNode<T> | undefined): Query<T | GroupingNode<T>> {
        if (elements.length === 0) {
            return from([]);
        }
        if (groupingIndex >= groupings.length) {
            return from(elements)
                .select(element => Object.create(element, { _visualParent: { value: parent } }) as T);
        }
        const provider = elements[0].provider;
        const nextGrouping = groupings[groupingIndex];
        const context = nextGrouping.context?.(elements, parent);
        return from(elements)
            .groupBy(
                value => nextGrouping.keySelector(value, context),
                identity,
                (key, elements) => new GroupingNode(provider, /*parent*/ undefined, context, key, elements.toArray(), groupings, groupingIndex),
                nextGrouping.keyEqualer)
            .through(nextGrouping.sorter ?? identity);
    }

    static createGrouping<T extends BaseNode, K>(options: GroupingOptions<T, K>) {
        return options;
    }

    static groupBy<T extends BaseNode, A extends readonly GroupingOptions<T>[] | []>(elements: readonly T[], groupings: A) {
        return GroupingNode._groupBy(elements, groupings, 0, /*parent*/ undefined);
    }
}
