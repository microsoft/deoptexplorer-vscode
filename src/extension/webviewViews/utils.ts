// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Location, ViewColumn } from "vscode";
import { CommandUri } from "../vscode/commandUri";
import { html, HtmlValue } from "../../core/html";
import { Sources } from "../../core/sources";
import { getScriptSourceUri } from "../fileSystemProviders/scriptSourceFileSystemProvider";

export interface LinkToFileOptions {
    title?: string;
    viewColumn?: ViewColumn;
    linkSources?: Sources;
}

export function renderLinkToFile(content: HtmlValue, location: Location | undefined, options: LinkToFileOptions = {}) {
    if (!location) return content;

    const uri = getScriptSourceUri(location.uri, options.linkSources);
    if (!uri) return content;

    return html`<a href="${new CommandUri("vscode.open", [
        uri,
        {
            viewColumn: options.viewColumn,
            preview: true,
            selection: location.range
        }
    ])}" title="${options.title ?? (location.uri.scheme === "file" ? location.uri.fsPath : location.uri.toString(/*skipEncoding*/ true))}">${content}</a>`;
}
