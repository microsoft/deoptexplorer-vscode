import { assert } from "#core/assert.js";
import { deserialize, serialize } from "#core/serializer.js";
import { FunctionState } from "#v8/enums/functionState.js";
import { CodeEntry, DynamicFuncCodeEntry } from "#v8/tools/codeentry.js";
import { ProfileViewNode } from "#v8/tools/profile_view.js";
import { URLSearchParams } from "url";
import { CancellationToken, FileDecoration, FileDecorationProvider, Location, ProviderResult, ThemeColor, Uri } from "vscode";
import * as constants from "../../constants";

export class ProfileNodeFileDecorationProvider implements FileDecorationProvider {
    private _rootNodeFileDecoration = new FileDecoration(/*badge*/ undefined, /*tooltip*/ undefined, new ThemeColor("list.deemphasizedForeground"));
    private _gcNodeFileDecoration = new FileDecoration(/*badge*/ undefined, /*tooltip*/ undefined, new ThemeColor("list.warningForeground"));
    private _idleNodeFileDecoration = new FileDecoration(/*badge*/ undefined, /*tooltip*/ undefined, new ThemeColor("list.deemphasizedForeground"));
    private _programNodeFileDecoration = new FileDecoration(/*badge*/ undefined, /*tooltip*/ undefined, new ThemeColor("list.deemphasizedForeground"));
    private _hiddenNodeFileDecoration = new FileDecoration(/*badge*/ undefined, /*tooltip*/ undefined, new ThemeColor("list.deemphasizedForeground"));
    private _unresolvedNodeFileDecoration = new FileDecoration(/*badge*/ undefined, /*tooltip*/ undefined, new ThemeColor("list.invalidItemForeground"));
    private _sharedLibraryNodeFileDecoration = new FileDecoration(/*badge*/ undefined, /*tooltip*/ undefined, new ThemeColor("list.deemphasizedForeground"));
    private _nativeCodeNodeFileDecoration = new FileDecoration(/*badge*/ undefined, /*tooltip*/ undefined, new ThemeColor("list.deemphasizedForeground"));
    private _nodeJsCodeNodeFileDecoration = new FileDecoration(/*badge*/ undefined, /*tooltip*/ undefined, new ThemeColor("list.deemphasizedForeground"));
    private _nodeModulesCodeNodeFileDecoration = new FileDecoration(/*badge*/ undefined, /*tooltip*/ undefined, new ThemeColor("list.deemphasizedForeground"));
    private _generatedCodeNodeFileDecoration = new FileDecoration(/*badge*/ undefined, /*tooltip*/ undefined, new ThemeColor("list.deemphasizedForeground"));
    private _inlinedCodeNodeFileDecoration = new FileDecoration(/*badge*/ "i", /*tooltip*/ "inlined", /*color*/ undefined);

    provideFileDecoration(uri: Uri, token: CancellationToken): ProviderResult<FileDecoration> {
        if (uri.scheme === constants.schemes.profileNode) {
            const { filePosition, type, generated, inlined } = parseProfileNodeUri(uri);
            if (type === "SHARED_LIB") return this._sharedLibraryNodeFileDecoration;
            if (type === "CPP") return this._nativeCodeNodeFileDecoration;
            if (filePosition === "root") return this._rootNodeFileDecoration;
            if (filePosition === "gc") return this._gcNodeFileDecoration;
            if (filePosition === "idle") return this._idleNodeFileDecoration;
            if (filePosition === "program") return this._programNodeFileDecoration;
            if (filePosition === "unresolved") return this._unresolvedNodeFileDecoration;
            if (filePosition === "hidden") return this._hiddenNodeFileDecoration;
            if (filePosition?.uri.scheme === "node") return this._nodeJsCodeNodeFileDecoration;
            if (filePosition?.uri.path.includes("/node_modules/")) return this._nodeModulesCodeNodeFileDecoration;
            if (generated) return this._generatedCodeNodeFileDecoration;
            if (inlined) return this._inlinedCodeNodeFileDecoration;
            return undefined;
        }
    }
}

export function getUriForProfileNode(node: ProfileViewNode) {
    const filePosition =
        node.entry === CodeEntry.gc_entry() ? "gc" :
        node.entry === CodeEntry.idle_entry() ? "idle" :
        node.entry === CodeEntry.program_entry() ? "program" :
        node.entry === CodeEntry.root_entry() ? "root" :
        node.entry === CodeEntry.unresolved_entry() ? "unresolved" :
        node.entry === CodeEntry.hidden_entry() ? "hidden" :
        node.entry.filePosition ? encodeURIComponent(JSON.stringify(serialize(node.entry.filePosition))) :
        "";
    const generated = node.entry.filePosition && !node.entry.generatedFilePosition ? `&generated=1` : ``;
    const inlined = node.entry instanceof DynamicFuncCodeEntry && node.entry.state === FunctionState.Inlined ? `&inlined=1` : ``;
    return Uri.parse(`${constants.schemes.profileNode}:${filePosition}?type=${node.entry.type}${generated}${inlined}`);
}

function parseProfileNodeUri(uri: Uri) {
    assert(uri.scheme === constants.schemes.profileNode);
    const filePosition =
        uri.path === "gc" ? "gc" :
        uri.path === "idle" ? "idle" :
        uri.path === "program" ? "program" :
        uri.path === "root" ? "root" :
        uri.path === "unresolved" ? "unresolved" :
        uri.path === "hidden" ? "hidden" :
        uri.path ? deserialize(JSON.parse(uri.path)) as Location :
        undefined;
    const params = new URLSearchParams(uri.query);
    const type = params.get("type") ?? undefined;
    const generated = !!params.get("generated");
    const inlined = !!params.get("inlined");
    return { filePosition, type, generated, inlined } as const;
}