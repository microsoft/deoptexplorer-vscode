// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BaseNodeProvider } from "../common/baseNodeProvider";
import { HelpNode } from "./helpNode";
import { OpenFileNode } from "./openFileNode";
import { RecentLogFilesNode } from "./recentLogFilesNode";
import { WorkspaceLogFilesNode } from "./workspaceLogFilesNode";

/**
 * Provides a quick file picker for recent or easily discovered log files.
 */
export class PickerTreeDataProvider extends BaseNodeProvider {
    private helpNode = new HelpNode(this);
    private openFileNode = new OpenFileNode(this);
    private recentFilesNode = new RecentLogFilesNode(this);
    private workspaceFilesNode = new WorkspaceLogFilesNode(this);

    constructor() {
        super(() => [this.helpNode, this.openFileNode, this.recentFilesNode, this.workspaceFilesNode]);
    }

    invalidate() {
        this.helpNode.invalidate();
        this.openFileNode.invalidate();
        this.recentFilesNode.invalidate();
        this.workspaceFilesNode.invalidate();
        super.invalidate();
    }
}
