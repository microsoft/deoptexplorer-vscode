// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Location, ViewColumn } from "vscode";
import { CommandUri } from "../vscode/commandUri";
import { html, HtmlValue } from "../../core/html";

export interface LinkToFileOptions {
    title?: string;
    viewColumn?: ViewColumn;
}

export function renderLinkToFile(content: HtmlValue, location: Location | undefined, options: LinkToFileOptions = {}) {
    if (!location) return content;
    return html`<a href="${new CommandUri("vscode.open", [
        location.uri,
        {
            viewColumn: options.viewColumn,
            preview: true,
            selection: location.range
        }
    ])}" title="${options.title ?? location.uri.fsPath}">${content}</a>`;
}
