// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ThemeIcon, TreeItem, TreeItemCollapsibleState } from "vscode";
import * as constants from "../../constants";
import { typeSafeCommand } from "../../vscode/commands";
import { BaseNode } from "../common/baseNode";
import { createTreeItem } from "../createTreeItem";
import type { PickerTreeDataProvider } from "./pickerTreeDataProvider";

export class OpenFileNode extends BaseNode {
    constructor(provider: PickerTreeDataProvider) {
        super(provider, /*parent*/ undefined);
    }

    /**
     * Gets the provider that provides this node.
     */
    get provider(): PickerTreeDataProvider { return super.provider as PickerTreeDataProvider; }

    /**
     * Gets the parent of the this node.
     */
    get parent(): undefined { return undefined; }

    protected createTreeItem(): TreeItem {
        return createTreeItem("Open Log File...", TreeItemCollapsibleState.None, {
            iconPath: new ThemeIcon("file-add"),
            command: typeSafeCommand({
                title: "",
                command: constants.commands.log.open,
                arguments: []
            }),
        });
    }
}
