// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "#core/assert.js";
import { deserialize, serialize } from "#core/serializer.js";
import { Uri } from "vscode";
import { CommandArgumentValue } from "../types";

/**
 * Formats a VSCode command URI for use in HTML and Markdown links.
 */
export class CommandUri {
    private _uri?: Uri;
    private _uriString?: string;

    /**
     * @param command The command name
     * @param commandArgument The argument to the command.
     */
    constructor(
        readonly command: string,
        readonly commandArgument?: CommandArgumentValue
    ) {
    }

    /**
     * Gets the {@link Uri} representation for the command.
     */
    toUri() {
        return this._uri ?? (this._uri = Uri.parse(this.toString()));
    }

    /**
     * Gets the string representation for the command.
     */
    toString() {
        return this._uriString ?? (this._uriString = `command:${this.command}${this.commandArgument !== undefined ? `?${CommandUri.encodeCommandArgument(this.commandArgument)}` : ""}`);
    }

    /**
     * Serializes and encodes a command argument URI component.
     * @param commandArgument The argument to a command
     * @returns The encoded command argument.
     */
    static encodeCommandArgument(commandArgument: CommandArgumentValue): string {
        return commandArgument !== undefined ? encodeURIComponent(JSON.stringify(serialize(commandArgument))) : "";
    }

    /**
     * Decodes and deserializes a command argument URI component.
     * @param commandArgumentString The component to decode.
     * @returns The decoded command argument.
     */
    static decodeCommandArgument(commandArgumentString: string) {
        return commandArgumentString ? deserialize(JSON.parse(decodeURIComponent(commandArgumentString))) as CommandArgumentValue : undefined;
    }

    /**
     * Extracts a {@link CommandUri} from a {@link Uri}.
     */
    static from(uri: Uri) {
        assert(uri.scheme === "command", "Invalid CommandUri");
        return new CommandUri(uri.path, this.decodeCommandArgument(uri.query));
    }

    /**
     * Parses a {@link CommandUri}.
     * @param text The text to parse.
     * @returns The parsed {@link CommandUri}.
     */
    static parse(text: string) {
        return this.from(Uri.parse(text, /*strict*/ true));
    }
}
