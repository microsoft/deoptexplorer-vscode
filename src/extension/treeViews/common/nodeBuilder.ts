import { BaseNode } from "./baseNode";
import { BaseNodeProvider } from "./baseNodeProvider";

export interface NodeBuilder<TProvider extends BaseNodeProvider, TParent extends BaseNode | undefined, TNode extends BaseNode> {
    readonly provider: TProvider;
    build(parent: TParent): TNode;
    flatten?(): Iterable<NodeBuilder<TProvider, TParent, TNode>>;
}

export interface NodeBuilderEntries<T extends NodeBuilder<BaseNodeProvider, BaseNode | undefined, BaseNode>> {
    readonly kind: string;
    readonly values: readonly T[];
}