// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// https://github.com/microsoft/vscode-test/issues/37#issuecomment-700167820
const vscode = require("vscode");
const jest_environment_node = require("jest-environment-node");
const NodeEnvironment = jest_environment_node.default ?? jest_environment_node;

class VsCodeEnvironment extends NodeEnvironment {
    async setup() {
        await super.setup();
        this.global.vscode = vscode;
    }

    async teardown() {
        this.global.vscode = null;
        await super.teardown();
    }
}

module.exports = VsCodeEnvironment;