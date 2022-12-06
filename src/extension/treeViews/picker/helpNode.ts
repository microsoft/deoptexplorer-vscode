// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ThemeIcon, TreeItemCollapsibleState } from "vscode";
import { typeSafeCommand } from "../../vscode/commands";
import { BaseNode } from "../common/baseNode";
import { createTreeItem } from "../createTreeItem";
import { PickerTreeDataProvider } from "./pickerTreeDataProvider";

export class HelpNode extends BaseNode {
    constructor(provider: PickerTreeDataProvider) {
        super(provider, /*parent*/ undefined);
    }

    protected createTreeItem() {
        return createTreeItem("Learn more...", TreeItemCollapsibleState.None, {
            iconPath: new ThemeIcon("question"),
            command: typeSafeCommand({
                title: "",
                command: "workbench.extensions.action.showExtensionsWithIds",
                arguments: [
                    ["rbuckton.deoptexplorer-vscode"]
                ]
            })
        });
    }
}