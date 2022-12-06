// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import type { BaseNode } from "./common/baseNode";
import type { BaseNodeProvider } from "./common/baseNodeProvider";
import { PageNode } from "./common/pageNode";

const PAGE_SIZE = 100;

export interface PaginationOptions {
    pageSize?: number;
    label?: (start: number, page: BaseNode[]) => string | undefined;
    description?: (start: number, page: BaseNode[]) => string | undefined;
}

export function paginateNodes(children: BaseNode[], paginationProvider: BaseNodeProvider, paginationParent: BaseNode | undefined, { pageSize = PAGE_SIZE, label, description }: PaginationOptions = {}): BaseNode[] {
    return children.length > pageSize
        ? from(children)
            .pageBy(pageSize)
            .toArray(page => new PageNode(paginationProvider, paginationParent, page.offset, [...page], label, description))
        : children;
}
