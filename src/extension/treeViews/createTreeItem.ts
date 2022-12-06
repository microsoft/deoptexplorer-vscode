// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { TreeItem, TreeItemCollapsibleState, TreeItemLabel, Uri } from "vscode";
import { TypeSafeCommand } from "../vscode/commands";

export interface TypeSafeTreeItemOptions extends Pick<TreeItem, "command" | "id" | "iconPath" | "tooltip" | "description" | "contextValue" | "resourceUri" | "label" | "accessibilityInformation"> {
    command?: TypeSafeCommand;
}

/**
 * Creates a visual `TreeItem`.
 */
export function createTreeItem(label: string | TreeItemLabel, state: TreeItemCollapsibleState, options?: Omit<TypeSafeTreeItemOptions, "label">): TreeItem
export function createTreeItem(resourceUri: Uri, state: TreeItemCollapsibleState, options?: Omit<TypeSafeTreeItemOptions, "resourceUri">): TreeItem
export function createTreeItem(labelOrResourceUri: string | TreeItemLabel | Uri, state: TreeItemCollapsibleState, options?: Omit<TypeSafeTreeItemOptions, "resourceUri" | "label">): TreeItem
export function createTreeItem(labelOrResourceUri: string | TreeItemLabel | Uri, state: TreeItemCollapsibleState, { command, id, iconPath, tooltip, description, contextValue, resourceUri, label }: TypeSafeTreeItemOptions = {}) {
    let item: TreeItem;
    if (labelOrResourceUri instanceof Uri) {
        item = new TreeItem(labelOrResourceUri, state);
        item.label = label;
    }
    else {
        item = new TreeItem(labelOrResourceUri, state);
        item.resourceUri = resourceUri;
    }
    item.id = id;
    item.iconPath = iconPath;
    item.tooltip = tooltip;
    item.description = description;
    item.contextValue = contextValue;
    item.command = command;
    return item;
}
