// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { from } from "@esfx/iter-query";
import { assert, assertNever } from "#core/assert.js";
import { isJavaScriptFile, isTypeScriptFile } from "#core/uri.js";
import { DeoptEntry } from "#deoptigate/deoptEntry.js";
import type { FunctionEntry } from "#deoptigate/functionEntry.js";
import type { IcEntry } from "#deoptigate/icEntry.js";
import { DeoptimizeKind } from "#v8/enums/deoptimizeKind.js";
import { IcType } from "#v8/enums/icType.js";
import { TextDocumentLike } from "#vscode/textDocumentLike.js";
import * as ts from "typescript";
import { Location, Position, Range, SymbolKind, Uri } from "vscode";
import type { Entry, LocationKind } from "../model/entry";
import { CharacterCodes } from "../types";

// #region Common

function getLocation(uriOrLocation: Uri | Location | undefined, range?: Range) {
    if (uriOrLocation instanceof Location) {
        assert(!range);
        return uriOrLocation;
    }
    if (uriOrLocation instanceof Uri && range instanceof Range) {
        return new Location(uriOrLocation, range);
    }
}

function setReferenceLocation(locationKind: LocationKind, entry: Entry, location: Location | undefined): boolean;
function setReferenceLocation(locationKind: LocationKind, entry: Entry, uri: Uri, range: Range | undefined): boolean;
function setReferenceLocation(locationKind: LocationKind, entry: Entry, uriOrLocation: Uri | Location | undefined, range?: Range) {
    const location = getLocation(uriOrLocation, range);
    if (!location) return false;

    switch (locationKind) {
        case "source":
            entry.referenceLocation = location;
            break;
        case "generated":
            entry.generatedReferenceLocation = location;
            break;
        default:
            assertNever(locationKind);
            break;
    }
    return true;
}

function setReferenceLocationFromNode(locationKind: LocationKind, entry: Entry, document: TextDocumentLike, node: ts.Node) {
    return setReferenceLocation(locationKind, entry, document.uri, getRangeForNode(document, node));
}

function getRangeForNode(document: TextDocumentLike, node: ts.Node) {
    return new Range(
        document.positionAt(node.getStart()),
        document.positionAt(node.getEnd()));
}

function tokenAt(sourceFile: ts.SourceFile, position: Position) {
    const offset = sourceFile.getPositionOfLineAndCharacter(position.line, position.character, /*allowEdits*/ true);
    return ts.getTokenAtPosition(sourceFile, offset);
}

function precedingTokenAt(sourceFile: ts.SourceFile, position: Position) {
    const offset = sourceFile.getPositionOfLineAndCharacter(position.line, position.character, /*allowEdits*/ true);
    return ts.findPrecedingToken(offset, sourceFile, /*startNode*/ undefined, /*excludeJsdoc*/ true);
}

function resolveLocations<T extends Entry>(locationKind: LocationKind, entry: T, tryResolveLocations: (locationKind: LocationKind, entry: T, filePosition: Location, document: TextDocumentLike, sourceFile: ts.SourceFile) => boolean) {
    const filePosition = entry.getLocation(locationKind);
    if (!filePosition) return false;

    const sourceFile = entry.getSourceFile(locationKind);
    if (sourceFile) {
        const document = TextDocumentLike.fromSourceFile(sourceFile, filePosition.uri);
        if (document) {
            if (tryResolveLocations(locationKind, entry, filePosition, document, sourceFile)) {
                return true;
            }
        }
        const range = document.getWordRangeAtPosition(filePosition.range.start) ?? filePosition.range;
        return setReferenceLocation(locationKind, entry, filePosition.uri, range);
    }

    return setReferenceLocation(locationKind, entry, filePosition.uri, filePosition.range);
}

// #endregion Common

// #region FunctionEntry locations

function setExtentLocation(locationKind: LocationKind, entry: FunctionEntry, location: Location | undefined): boolean;
function setExtentLocation(locationKind: LocationKind, entry: FunctionEntry, uri: Uri, range: Range | undefined): boolean;
function setExtentLocation(locationKind: LocationKind, entry: FunctionEntry, uriOrLocation: Uri | Location | undefined, range?: Range) {
    const location = getLocation(uriOrLocation, range);
    if (!location) return false;

    switch (locationKind) {
        case "source":
            entry.extentLocation = location;
            break;
        case "generated":
            entry.generatedExtentLocation = location;
            break;
        default:
            assertNever(locationKind);
            break;
    }
    return true;
}

function getRangeForNameOrKeywordOfFunction(document: TextDocumentLike, node: ts.FunctionDeclaration | ts.FunctionExpression) {
    // function foo() {}
    //          ~~~
    if (node.name) return getRangeForNode(document, node.name);

    // function () {}
    // ~~~~~~~~
    const range = ts.moveRangePastModifiers(node);
    const start = ts.skipTrivia(document.getText(), range.pos);
    const end = start + "function".length;
    return new Range(document.positionAt(start), document.positionAt(end));
}

function getRangeForKeywordOfConstructor(document: TextDocumentLike, node: ts.ConstructorDeclaration) {
    // constructor() {}
    // ~~~~~~~~~~~
    //
    // "constructor"() {}
    // ~~~~~~~~~~~~~
    if (node.name) return getRangeForNode(document, node.name);
    const range = ts.moveRangePastModifiers(node);
    const text = document.getText();
    const start = ts.skipTrivia(text, range.pos);
    const ch = text.charCodeAt(start);
    const isString = ch === CharacterCodes.singleQuote || ch === CharacterCodes.doubleQuote;
    const end = start + "constructor".length + (isString ? 2 : 0);
    return new Range(document.positionAt(start), document.positionAt(end));
}

function getRangeForNameOfMethod(document: TextDocumentLike, node: ts.MethodDeclaration | ts.AccessorDeclaration) {
    // method() {}
    // ~~~~~~
    //
    // get foo() {}
    //     ~~~
    return getRangeForNode(document, node.name);
}

function getRangeForEqualsGreaterThanTokenOfArrowFunction(document: TextDocumentLike, node: ts.ArrowFunction) {
    // () => {}
    //    ~~
    if (node.equalsGreaterThanToken) return getRangeForNode(document, node.equalsGreaterThanToken);
    const range = ts.moveRangePastModifiers(node);
    const start = ts.skipTrivia(document.getText(), range.pos);
    const end = node.body.getFullStart();
    return new Range(document.positionAt(start), document.positionAt(end));
}

function setFunctionLocationsFromFunctionNode(locationKind: LocationKind, entry: FunctionEntry, document: TextDocumentLike, node: ts.FunctionDeclaration | ts.FunctionExpression) {
    const uri = document.uri;
    setReferenceLocation(locationKind, entry, uri, getRangeForNameOrKeywordOfFunction(document, node));
    setExtentLocation(locationKind, entry, uri, getRangeForNode(document, node));
    return true;
}

function setFunctionLocationsForConstructorNode(locationKind: LocationKind, entry: FunctionEntry, document: TextDocumentLike, node: ts.ConstructorDeclaration) {
    const uri = document.uri;
    setReferenceLocation(locationKind, entry, uri, getRangeForKeywordOfConstructor(document, node));
    setExtentLocation(locationKind, entry, uri, getRangeForNode(document, node));
    return true;
}

function setFunctionLocationsForMethodNode(locationKind: LocationKind, entry: FunctionEntry, document: TextDocumentLike, node: ts.MethodDeclaration | ts.AccessorDeclaration) {
    const uri = document.uri;
    setReferenceLocation(locationKind, entry, uri, getRangeForNameOfMethod(document, node));
    setExtentLocation(locationKind, entry, uri, getRangeForNode(document, node));
    return true;
}

function setFunctionLocationsForArrowFunctionNode(locationKind: LocationKind, entry: FunctionEntry, document: TextDocumentLike, node: ts.ArrowFunction) {
    const uri = document.uri;
    setReferenceLocation(locationKind, entry, uri, getRangeForEqualsGreaterThanTokenOfArrowFunction(document, node));
    setExtentLocation(locationKind, entry, uri, getRangeForNode(document, node));
    return true;
}

function tryResolveFunctionLocationsFallback(locationKind: LocationKind, entry: FunctionEntry, filePosition: Location, document: TextDocumentLike, sourceFile: ts.SourceFile) {
    const token = tokenAt(sourceFile, filePosition.range.start);

    // NOTE: ▼ - Indicates current token
    //       ~ - Indicates derived range
    if (token.kind === ts.SyntaxKind.OpenParenToken) {
        if (ts.isFunctionDeclaration(token.parent) || ts.isFunctionExpression(token.parent)) {
            //           ▼
            // function f() {}
            //          ~
            //
            //          ▼
            // function () {}
            // ~~~~~~~~
            return setFunctionLocationsFromFunctionNode(locationKind, entry, document, token.parent);
        }
        if (ts.isConstructorDeclaration(token.parent)) {
            //            ▼
            // constructor() {}
            // ~~~~~~~~~~~
            return setFunctionLocationsForConstructorNode(locationKind, entry, document, token.parent);
        }
        if ((ts.isMethodDeclaration(token.parent) || ts.isAccessor(token.parent))) {
            //       ▼
            // method() {}
            // ~~~~~~
            //
            //        ▼
            // get foo() {}
            //     ~~~
            return setFunctionLocationsForMethodNode(locationKind, entry, document, token.parent);
        }
        if ((ts.isArrowFunction(token.parent))) {
            // ▼
            // () => {}
            //    ~~
            //
            //       ▼
            // async () => {}
            //          ~~
            return setFunctionLocationsForArrowFunctionNode(locationKind, entry, document, token.parent);
        }
        if (ts.isParenthesizedExpression(token.parent) && ts.isArrowFunction(token.parent.expression)) {
            // ▼
            // (a => {})
            //    ~~
            return setFunctionLocationsForArrowFunctionNode(locationKind, entry, document, token.parent.expression);
        }
        if (ts.isCallExpression(token.parent) && token.parent.arguments.length && ts.isArrowFunction(token.parent.arguments[0])) {
            //  ▼
            // f(a => {})
            //     ~~
            return setFunctionLocationsForArrowFunctionNode(locationKind, entry, document, token.parent.arguments[0] as ts.ArrowFunction);
        }
    }
    if (token.kind === ts.SyntaxKind.OpenBracketToken && ts.isArrayLiteralExpression(token.parent) && token.parent.elements.length && ts.isArrowFunction(token.parent.elements[0])) {
        // ▼
        // [a => {}]
        //    ~~
        return setFunctionLocationsForArrowFunctionNode(locationKind, entry, document, token.parent.elements[0] as ts.ArrowFunction);
    }
    if (token.kind === ts.SyntaxKind.Identifier) {
        if (ts.isParameter(token.parent)) {
            if (ts.isArrowFunction(token.parent.parent)) {
                // ▼
                // a => {}
                //   ~~
                return setFunctionLocationsForArrowFunctionNode(locationKind, entry, document, token.parent.parent);
            }
            if (ts.isFunctionDeclaration(token.parent.parent) || ts.isFunctionExpression(token.parent.parent)) {
                //               ▼
                // function foo (a) {}
                //          ~~~
                return setFunctionLocationsFromFunctionNode(locationKind, entry, document, token.parent.parent);
            }
            if (ts.isConstructorDeclaration(token.parent.parent)) {
                //              ▼
                // constructor (a) {}
                // ~~~~~~~~~~~
                return setFunctionLocationsForConstructorNode(locationKind, entry, document, token.parent.parent);
            }
            if (ts.isMethodDeclaration(token.parent.parent) || ts.isAccessor(token.parent.parent)) {
                //         ▼
                // method (a) {}
                // ~~~~~~
                //
                //          ▼
                // set foo (a) {}
                //     ~~~
                return setFunctionLocationsForMethodNode(locationKind, entry, document, token.parent.parent);
            }
        }
        if (ts.isFunctionDeclaration(token.parent) || ts.isFunctionExpression(token.parent)) {
            //           ▼
            // function f() {}
            //          ~
            //
            //          ▼
            // function () {}
            // ~~~~~~~~
            return setFunctionLocationsFromFunctionNode(locationKind, entry, document, token.parent);
        }
        if (ts.isConstructorDeclaration(token.parent)) {
            //            ▼
            // constructor() {}
            // ~~~~~~~~~~~
            return setFunctionLocationsForConstructorNode(locationKind, entry, document, token.parent);
        }
        if ((ts.isMethodDeclaration(token.parent) || ts.isAccessor(token.parent))) {
            //       ▼
            // method() {}
            // ~~~~~~
            //
            //        ▼
            // get foo() {}
            //     ~~~
            return setFunctionLocationsForMethodNode(locationKind, entry, document, token.parent);
        }
        return setReferenceLocationFromNode(locationKind, entry, document, token);
    }
    return false;
}

function tryResolveFunctionLocationsInJavaScript(locationKind: LocationKind, entry: FunctionEntry, filePosition: Location, document: TextDocumentLike, sourceFile: ts.SourceFile) {
    const token = tokenAt(sourceFile, filePosition.range.start);
    let node = token;
    while (node) {
        if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
            //           ▼
            // function f() {}
            //          ~
            //
            //          ▼
            // function () {}
            // ~~~~~~~~
            return setFunctionLocationsFromFunctionNode(locationKind, entry, document, node);
        }
        if (ts.isConstructorDeclaration(node)) {
            //            ▼
            // constructor() {}
            // ~~~~~~~~~~~
            return setFunctionLocationsForConstructorNode(locationKind, entry, document, node);
        }
        if ((ts.isMethodDeclaration(node) || ts.isAccessor(node))) {
            //       ▼
            // method() {}
            // ~~~~~~
            //
            //        ▼
            // get foo() {}
            //     ~~~
            return setFunctionLocationsForMethodNode(locationKind, entry, document, node);
        }
        if ((ts.isArrowFunction(node))) {
            // ▼
            // () => {}
            //    ~~
            //
            //       ▼
            // async () => {}
            //          ~~
            return setFunctionLocationsForArrowFunctionNode(locationKind, entry, document, node);
        }
        node = node.parent;
    }

    return false;
}

function tryResolveFunctionLocationsInTypeScript(locationKind: LocationKind, entry: FunctionEntry, filePosition: Location, document: TextDocumentLike, sourceFile: ts.SourceFile) {
    assert(locationKind === "source");
    if (entry.generatedReferenceLocation && entry.generatedExtentLocation) {
        const sourceMap = entry.getSourceMap();
        if (sourceMap) {
            let changed = false;
            const sourceReferenceLocation = sourceMap.toSourceLocation(entry.generatedReferenceLocation);
            const sourceExtentLocation = sourceMap.toSourceLocation(entry.generatedExtentLocation);
            if (sourceReferenceLocation?.range.isEmpty || sourceExtentLocation?.range.isEmpty) {
                if (tryResolveFunctionLocationsFallback(locationKind, entry, filePosition, document, sourceFile)) {
                    return true;
                }
            }
            if (setReferenceLocation(locationKind, entry, sourceReferenceLocation)) changed = true;
            if (setExtentLocation(locationKind, entry, sourceExtentLocation)) changed = true;
            if (changed) {
                return true;
            }
        }
    }
    return tryResolveFunctionLocationsFallback(locationKind, entry, filePosition, document, sourceFile);
}

function tryResolveSymbolInfo(entry: FunctionEntry, fileUri: Uri, sourceFile: ts.SourceFile, resolveName: boolean) {
    const location = entry.pickReferenceLocation(fileUri);
    const token = tokenAt(sourceFile, location.range.start);
    let nameContext: ts.NamedDeclaration | undefined;
    if (ts.isModuleDeclaration(token.parent)) {
        if (ts.isIdentifier(token.parent.name)) nameContext = token.parent;
        entry.symbolKind = SymbolKind.Namespace;
    }
    else if (ts.isEnumDeclaration(token.parent)) {
        nameContext = token.parent;
        entry.symbolKind = SymbolKind.Enum;
    }
    else if (ts.isEnumMember(token.parent)) {
        nameContext = token.parent.parent;
        entry.symbolKind = SymbolKind.Enum;
    }
    else if (ts.isClassLike(token.parent)) {
        nameContext = token.parent;
        entry.symbolKind = SymbolKind.Class;
    }
    else if (ts.isConstructorDeclaration(token.parent)) {
        nameContext = token.parent.parent;
        entry.symbolKind = SymbolKind.Property;
    }
    else if (ts.isClassStaticBlockDeclaration(token.parent)) {
        nameContext = token.parent.parent;
        entry.symbolKind = SymbolKind.Property;
    }
    else if (ts.isMethodDeclaration(token.parent)) {
        nameContext = ts.isClassLike(token.parent) ? token.parent : ts.findAncestor(token.parent.parent, ts.isFunctionLike);
        entry.symbolKind = SymbolKind.Method;
    }
    else if (ts.isAccessor(token.parent)) {
        nameContext = ts.isClassLike(token.parent) ? token.parent : ts.findAncestor(token.parent.parent, ts.isFunctionLike);
        entry.symbolKind = SymbolKind.Property;
    }
    else if (ts.isPropertyDeclaration(token.parent)) {
        nameContext = token.parent;
        entry.symbolKind = SymbolKind.Field;
    }
    if (resolveName && nameContext) {
        let functionName =
            nameContext.name && ts.isIdentifier(nameContext.name) ? ts.idText(nameContext.name) :
            ts.isClassDeclaration(nameContext) ? "default" :
            undefined;
        if (functionName) {
            if (ts.isClassStaticBlockDeclaration(token.parent)) {
                functionName += " static {}";
            }
            if (!entry.generatedFunctionName && entry.functionName !== functionName) {
                entry.generatedFunctionName = entry.functionName;
                entry.functionName = functionName;
            }
        }
    }
}

function tryResolveFunctionLocations(locationKind: LocationKind, entry: FunctionEntry, filePosition: Location, document: TextDocumentLike, sourceFile: ts.SourceFile) {
    if (isJavaScriptFile(filePosition.uri)) {
        if (tryResolveFunctionLocationsInJavaScript(locationKind, entry, filePosition, document, sourceFile)) {
            tryResolveSymbolInfo(entry, filePosition.uri, sourceFile, /*resolveName*/ false);
            return true;
        }
    }
    if (isTypeScriptFile(filePosition.uri)) {
        if (tryResolveFunctionLocationsInTypeScript(locationKind, entry, filePosition, document, sourceFile)) {
            tryResolveSymbolInfo(entry, filePosition.uri, sourceFile, !entry.functionName || entry.functionName === "(anonymous)");
            return true;
        }
    }
    return false;
}

export function resolveFunctionLocations(locationKind: LocationKind, entry: FunctionEntry) {
    return resolveLocations(locationKind, entry, tryResolveFunctionLocations);
}

// #endregion FunctionEntry locations

// #region IcEntry Locations

// function getRangeForAccessLikeIdentifier(document: TextDocumentLike, node: ts.Identifier, key?: string) {
//     if (key && node.text === key) {
//         return getRangeForNode(document, node);
//     }
//     if (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) {
//         return getRangeForAccessExpression(document, node.parent, key);
//     }
//     return getRangeForNode(document, node);
// }

// function getRangeForAccessExpression(document: TextDocumentLike, node: ts.ElementAccessExpression | ts.PropertyAccessExpression, key?: string) {
//     if (key !== undefined && ts.isIdentifier(node.expression) && node.expression.text === key) {
//         return getRangeForNode(document, node.expression);
//     }
//     // if (node.questionDotToken) {
//     //     // a?.b
//     //     //    ~
//     //     //
//     //     // a?.[b]
//     //     //     ~
//     //     return new Range(document.positionAt(node.questionDotToken.getStart()), document.positionAt(node.getEnd()));
//     // }
//     if (ts.isPropertyAccessExpression(node)) {
//         // a.b
//         //   ~
//         return getRangeForNode(document, node.name);
//         // return new Range(document.positionAt(ts.skipTrivia(document.getText(), node.expression.getEnd())), document.positionAt(node.getEnd()));
//     }
//     // a[b]
//     //   ~
//     return getRangeForNode(document, node.argumentExpression);
//     // const start = ts.skipTrivia(document.getText(), node.expression.getEnd());
//     // return new Range(document.positionAt(start), document.positionAt(node.getEnd()));
// }

// function getRangeForStoreICExpression(document: TextDocumentLike, node: ts.Node, key: string) {
//     let expression = node;
//     while (true) {
//         if (ts.isNonNullExpression(expression)) {
//             //      ▼
//             // a.b!!! = c
//             //   ~
//             expression = expression.expression;
//         }
//         else {
//             break;
//         }
//     }
//     if (ts.isPropertyAccessExpression(expression) ||
//         ts.isElementAccessExpression(expression)) {
//         return getRangeForAccessExpression(document, expression, key);
//     }
//     if (ts.isIdentifier(expression)) {
//         return getRangeForAccessLikeIdentifier(document, expression, key); // source mapped namespace qualified alias
//     }
// }

// function getRangeForLoadICExpression(document: TextDocumentLike, node: ts.Node, key?: string) {
//     let expression = node;
//     while (true) {
//         if (ts.isCallExpression(expression) ||
//             ts.isAsExpression(expression) ||
//             ts.isTypeAssertion(expression) ||
//             ts.isNonNullExpression(expression)) {
//             // f(a.b)
//             //     ~
//             //
//             // a.b as T
//             //   ~
//             //
//             // <T>a.b
//             //      ~
//             //
//             // a.b!
//             //   ~
//             expression = expression.expression;
//         }
//         else if (ts.isBinaryExpression(expression)) {
//             // a.b === c
//             //   ~
//             expression = expression.left;
//         }
//         else if (ts.isPostfixUnaryExpression(expression)) {
//             // a.b++
//             //   ~
//             expression = expression.operand;
//         }
//         else if (ts.isConditionalExpression(expression)) {
//             // a.b ? c : d
//             //   ~
//             expression = expression.condition;
//         }
//         else if (ts.isTaggedTemplateExpression(expression)) {
//             // a.b `c`
//             //   ~
//             expression = expression.tag;
//         }
//         else {
//             break;
//         }
//     }
//     if (ts.isPropertyAccessExpression(expression) ||
//         ts.isElementAccessExpression(expression)) {
//         return getRangeForAccessExpression(document, expression, key);
//     }
//     if (ts.isIdentifier(expression)) {
//         return getRangeForAccessLikeIdentifier(document, expression, key); // source mapped namespace qualified alias
//     }
// }

function tryResolveIcLocationInJavaScript(locationKind: LocationKind, entry: IcEntry, filePosition: Location, document: TextDocumentLike, sourceFile: ts.SourceFile): boolean {
    const worst = from(entry.updates).maxBy(update => update.newState);
    assert(worst);
    
    // NOTE: ▼ - Indicates current token
    //       ~ - Indicates derived range
    let token = tokenAt(sourceFile, filePosition.range.start);
    if (worst.type === IcType.LoadIC || worst.type === IcType.KeyedLoadIC) {
        let node = token;
        while (node && !ts.isStatement(node)) {
            if (ts.isPropertyAccessExpression(node)) {
                // ▼
                // a.b
                //   ~
                //
                //  ▼
                // a.b
                //   ~
                //
                //   ▼
                // a.b
                //   ~
                return setReferenceLocationFromNode(locationKind, entry, document, node.name);
            }
            if (ts.isElementAccessExpression(node)) {
                // ▼
                // a[b]
                //   ~
                //
                //  ▼
                // a[b]
                //   ~
                //
                //   ▼
                // a[b]
                //   ~
                //
                //    ▼
                // a[b]
                //   ~
                return setReferenceLocationFromNode(locationKind, entry, document, node.argumentExpression);
            }
            node = node.parent;
        }
    }
    else if (worst.type === IcType.StoreIC || worst.type === IcType.KeyedStoreIC) {
        let node = token;
        while (node && !ts.isStatement(node)) {
            if (ts.isBinaryExpression(node)) {
                //   ▼
                // a = b
                //   ~
                return setReferenceLocationFromNode(locationKind, entry, document, node.operatorToken);
            }
            if (ts.isPropertyAccessExpression(node)) {
                // ▼
                // a.b
                //   ~
                //
                //  ▼
                // a.b
                //   ~
                //
                //   ▼
                // a.b
                //   ~
                return setReferenceLocationFromNode(locationKind, entry, document, node.name);
            }
            if (ts.isElementAccessExpression(node)) {
                // ▼
                // a[b]
                //   ~
                //
                //  ▼
                // a[b]
                //   ~
                //
                //   ▼
                // a[b]
                //   ~
                //
                //    ▼
                // a[b]
                //   ~
                return setReferenceLocationFromNode(locationKind, entry, document, node.argumentExpression);
            }
            if (ts.isPropertyAssignment(node)) {
                //   ▼
                // { a: b, }
                //   ~
                //
                //    ▼
                // { a: b, }
                //   ~
                //
                //      ▼
                // { a: b, }
                //   ~
                //
                //       ▼
                // { a: b, }
                //   ~
                return setReferenceLocationFromNode(locationKind, entry, document, node.name);
            }
            if (ts.isShorthandPropertyAssignment(node)) {
                //   ▼
                // { a, }
                //   ~
                //
                //    ▼
                // { a, }
                //   ~
                return setReferenceLocationFromNode(locationKind, entry, document, node.name);
            }
            if (ts.isSpreadAssignment(node)) {
                //   ▼▼▼
                // { ...a, }
                //      ~
                //
                //      ▼
                // { ...a, }
                //      ~
                //
                //       ▼
                // { ...a, }
                //      ~
                return setReferenceLocationFromNode(locationKind, entry, document, node.expression);
            }
            node = node.parent;
        }
    }
    else if (worst.type === IcType.LoadGlobalIC || worst.type === IcType.StoreGlobalIC) {
        if (token.kind === ts.SyntaxKind.ReturnKeyword) {
            // ▼▼▼▼▼▼
            // return Object
            //        ~~~~~~
            token = tokenAt(sourceFile, document.positionAt(token.end));
        }
        if (token.kind === ts.SyntaxKind.NewKeyword) {
            // ▼▼▼
            // new Map()
            //     ~~~
            token = tokenAt(sourceFile, document.positionAt(token.end));
        }
        if (ts.isIdentifier(token)) {
            // ▼▼▼▼▼▼
            // Object
            // ~~~~~~
            return setReferenceLocationFromNode(locationKind, entry, document, token);
        }
        let node = token;
        while (node && !ts.isStatement(node)) {
            if (ts.isBinaryExpression(node)) {
                return setReferenceLocationFromNode(locationKind, entry, document, node.operatorToken);
            }
            node = node.parent;
        }
    }
    else if (worst.type === IcType.StoreInArrayLiteralIC) {
        let node = token;
        while (node && !ts.isStatement(node)) {
            if (ts.isArrayLiteralExpression(node.parent)) {
                //  ▼
                // [a, ]
                //  ~
                return setReferenceLocationFromNode(locationKind, entry, document, node);
            }
            node = node.parent;
        }
    }
    return false;

    // TODO(rbuckton): This is old logic that I've preserved in case I need to reintroduce it...
    //// if (worst?.type === "KeyedStoreIC" || worst?.type === "StoreIC") {
    ////     // Store a value in a property using either property access (usually StoreIC), or element access
    ////     // (usually KeyedStoreIC).
    ////     //
    ////     // NOTE: Some element-access source can be converted to a property access by V8 if it is a literal
    ////     // access (i.e. `a["b"]`).
    ////     //
    ////     // NOTE: Some property-access source can be converted to an element access by TypeScript when
    ////     // downleveling (i.e. `a.default` -> `a["default"]`).
    ////
    ////     //    ▼
    ////     // a[b] = c
    ////     //  ~~~
    ////     if (token.kind === ts.SyntaxKind.CloseBracketToken &&
    ////         ts.isElementAccessExpression(token.parent)) {
    ////         if (setReferenceLocation(entry, filePosition, getRangeForStoreICExpression(document, token.parent, worst.key))) {
    ////             return true;
    ////         }
    ////     }
    ////
    ////     //  ▼
    ////     // a.b = c
    ////     //   ~
    ////     if (token.kind === ts.SyntaxKind.DotToken &&
    ////         ts.isPropertyAccessExpression(token.parent)) {
    ////         if (setReferenceLocation(entry, filePosition, getRangeForStoreICExpression(document, token.parent, worst.key))) {
    ////             return true;
    ////         }
    ////     }
    ////
    ////     //     ▼
    ////     // a.b = c
    ////     //   ~
    ////     if (token.kind >= ts.SyntaxKind.FirstAssignment && token.kind <= ts.SyntaxKind.LastAssignment &&
    ////         ts.isBinaryExpression(token.parent)) {
    ////         if (setReferenceLocation(entry, filePosition, getRangeForStoreICExpression(document, token.parent.left, worst.key))) {
    ////             return true;
    ////         }
    ////     }
    ////
    ////     //    ▼
    ////     // a.b! = c
    ////     //   ~
    ////     if (token.kind === ts.SyntaxKind.ExclamationToken &&
    ////         ts.isNonNullExpression(token.parent)) {
    ////         if (setReferenceLocation(entry, filePosition, getRangeForStoreICExpression(document, token.parent.expression, worst.key))) {
    ////             return true;
    ////         }
    ////     }
    ////
    ////     //  ▼▼▼
    ////     // [...a]
    ////     //  ~~~
    ////     //
    ////     //  ▼▼▼
    ////     // {...a}
    ////     //  ~~~
    ////     if (token.kind === ts.SyntaxKind.DotDotDotToken) {
    ////         return setReferenceLocationFromNode(entry, filePosition, document, token);
    ////     }
    ////
    ////     //    ▼
    ////     // { a, b }
    ////     //   ~
    ////     if (token.kind === ts.SyntaxKind.CommaToken &&
    ////         ts.isObjectLiteralExpression(token.parent)) {
    ////         let precedingProperty: ts.ObjectLiteralElementLike | undefined;
    ////         for (const property of token.parent.properties) {
    ////             if (property.getEnd() > token.getStart()) {
    ////                 break;
    ////             }
    ////             precedingProperty = property;
    ////         }
    ////         if (precedingProperty) {
    ////             if (ts.isPropertyAssignment(precedingProperty) ||
    ////                 ts.isShorthandPropertyAssignment(precedingProperty)) {
    ////                 return setReferenceLocationFromNode(entry, filePosition, document, precedingProperty.name);
    ////             }
    ////         }
    ////     }
    ////
    ////     //       ▼
    ////     // { a, b }
    ////     //      ~
    ////     if (token.kind === ts.SyntaxKind.CloseBraceToken &&
    ////         ts.isObjectLiteralExpression(token.parent)) {
    ////         const precedingProperty = token.parent.properties.length ? token.parent.properties[token.parent.properties.length - 1] : undefined;
    ////         if (precedingProperty) {
    ////             if (ts.isPropertyAssignment(precedingProperty) ||
    ////                 ts.isShorthandPropertyAssignment(precedingProperty)) {
    ////                 return setReferenceLocationFromNode(entry, filePosition, document, precedingProperty.name);
    ////             }
    ////         }
    ////     }
    ////
    ////     // For down-leveling and source maps:
    ////     //
    ////     // Source (ts)          Generated (hs)
    ////     // -----------          --------------
    ////     // ▼                       ▼
    ////     // a = b                ns.a = b
    ////     // ~                       ~
    ////     //
    ////     //   ▼                    ▼
    ////     // { foo() { } }        { foo: function () { } }
    ////     //   ~~~                  ~~~
    ////     if (token.kind === ts.SyntaxKind.Identifier) {
    ////         if (ts.isEnumMember(token.parent) ||
    ////             ts.isMethodDeclaration(token.parent)) {
    ////             return setReferenceLocationFromNode(entry, filePosition, document, token);
    ////         }
    ////     }
    ////
    ////     // TODO(rbuckton): Clean this up
    ////     // worst case, walk up to find a property assignment.
    ////     let node: ts.Node = token;
    ////     while (node.parent &&
    ////         !ts.isStatement(node.parent) &&
    ////         !ts.isSourceFile(node.parent) &&
    ////         !ts.isCaseOrDefaultClause(node.parent) &&
    ////         !ts.isCaseBlock(node.parent) &&
    ////         !ts.isObjectLiteralExpression(node.parent)) {
    ////         //       ▼
    ////         // {a: b.c}
    ////         //  ~
    ////         //
    ////         //  ▼
    ////         // {a}
    ////         //  ~
    ////         if (ts.isPropertyAssignment(node.parent) ||
    ////             ts.isShorthandPropertyAssignment(node.parent)) {
    ////             return setReferenceLocationFromNode(entry, filePosition, document, node.parent.name);
    ////         }
    ////
    ////         //       ▼
    ////         // {...a.b}
    ////         //  ~~~
    ////         if (ts.isSpreadAssignment(node.parent)) {
    ////             return setReferenceLocation(entry, filePosition, new Range(
    ////                 document.positionAt(node.parent.getStart()),
    ////                 document.positionAt(node.parent.expression.getFullStart())
    ////             ));
    ////         }
    ////
    ////         //       ▼
    ////         // a.b = c
    ////         //   ~
    ////         if (ts.isAssignmentExpression(node.parent) && ts.isPropertyAccessExpression(node.parent.left)) {
    ////             return setReferenceLocationFromNode(entry, filePosition, document, node.parent.left.name);
    ////         }
    ////
    ////         node = node.parent;
    ////     }
    //// }
    //// else if (worst?.type === "KeyedLoadIC" || worst?.type === "LoadIC") {
    ////     // Loads a value from a property using either property access (usually LoadIC), or element access
    ////     // (usually KeyedLoadIC).
    ////     //
    ////     // NOTE: Some element-access source can be converted to a property access by V8 if it is a literal
    ////     // access (i.e. `a["b"]`).
    ////     //
    ////     // NOTE: Some property-access source can be converted to an element access by TypeScript when
    ////     // downleveling (i.e. `a.default` -> `a["default"]`).
    ////
    ////     if (token.kind === ts.SyntaxKind.OpenBraceToken &&
    ////         ts.isObjectBindingPattern(token.parent)) {
    ////
    ////         // NOTE: This is incorrect, it puts the marker on the initializer instead of the property being read...
    ////         // if (ts.isBindingElement(token.parent.parent) ||
    ////         //     ts.isVariableDeclaration(token.parent.parent) ||
    ////         //     ts.isParameter(token.parent.parent)) {
    ////         //     if (token.parent.parent.initializer) {
    ////         //         const range = getRangeForLoadICExpression(document, token.parent.parent.initializer);
    ////         //         if (range) return range;
    ////         //         return getRangeForNode(document, token.parent);
    ////         //     }
    ////         //     if (ts.isVariableDeclaration(token.parent.parent) && ts.isVariableDeclarationList(token.parent.parent.parent)) {
    ////         //         if (ts.isForOfStatement(token.parent.parent.parent.parent) ||
    ////         //             ts.isForInStatement(token.parent.parent.parent.parent)) {
    ////         //             const range = getRangeForLoadICExpression(document, token.parent.parent.parent.parent.expression);
    ////         //             if (range) return range;
    ////         //         }
    ////         //     }
    ////         // }
    ////
    ////         if (token.parent.elements.length === 1) {
    ////             const first = token.parent.elements[0];
    ////
    ////             //       ▼
    ////             // const { a } = b.c
    ////             //         ~
    ////             //
    ////             //       ▼
    ////             // const { a: b } = b.c
    ////             //         ~
    ////             //
    ////             //       ▼
    ////             // const { ...c } = b.c
    ////             //         ~~~
    ////             return setReferenceLocationFromNode(entry, filePosition, document, first.dotDotDotToken ?? first.propertyName ?? first.name);
    ////         }
    ////
    ////         // TODO: Consider using `.key` to try to figure out which declaration to use to narrow this...
    ////         //       ▼
    ////         // const { a, b } = b.c
    ////         //       ~~~~~~~~
    ////         return setReferenceLocationFromNode(entry, filePosition, document, token.parent);
    ////     }
    ////
    ////     if (token.kind === ts.SyntaxKind.OpenBracketToken) {
    ////         if (ts.isArrayLiteralExpression(token.parent)) {
    ////             if (worst.key === "length") {
    ////                 // TODO(rbuckton): Revisit this...
    ////                 // ▼
    ////                 // [a, b]
    ////                 // ~~~~~~
    ////                 return setReferenceLocationFromNode(entry, filePosition, document, token.parent);
    ////             }
    ////             if (token.parent.elements.length > 0) {
    ////                 // TODO(rbuckton): Revisit this...
    ////                 // ▼
    ////                 // [a, b]
    ////                 //  ~
    ////                 if (setReferenceLocation(entry, filePosition, getRangeForLoadICExpression(document, token.parent.elements[0], worst.key))) {
    ////                     return true;
    ////                 }
    ////             }
    ////         }
    ////         if (ts.isArrayBindingPattern(token.parent)) {
    ////             // TODO(rbuckton): Revisit this...
    ////             //       ▼
    ////             // const [a, b] = c
    ////             //       ~
    ////             const first = token.parent.elements[0];
    ////             return setReferenceLocationFromNode(entry, filePosition, document, ts.isBindingElement(first) ? first.name : first);
    ////         }
    ////     }
    ////     if (token.kind === ts.SyntaxKind.InKeyword ||
    ////         token.kind === ts.SyntaxKind.OfKeyword) {
    ////         //   ▼▼
    ////         // a in b
    ////         //   ~~
    ////         //
    ////         //        ▼▼
    ////         // for (a in b) { }
    ////         //        ~~
    ////         //
    ////         //        ▼▼
    ////         // for (a of b) { }
    ////         //        ~~
    ////         return setReferenceLocationFromNode(entry, filePosition, document, token);
    ////     }
    ////     if (token.kind === ts.SyntaxKind.GreaterThanToken &&
    ////         ts.isTypeAssertion(token.parent)) {
    ////         //    ▼
    ////         // (<T>a.b)
    ////         //       ~
    ////         if (setReferenceLocation(entry, filePosition, getRangeForLoadICExpression(document, token.parent.expression, worst.key))) {
    ////             return true;
    ////         }
    ////     }
    ////     if (token.kind === ts.SyntaxKind.YieldKeyword &&
    ////         ts.isYieldExpression(token.parent)) { // downleveled yield
    ////         // Source (ts)          Generated (js)
    ////         // -----------          --------------
    ////         // ▼▼▼▼▼                       ▼▼▼▼▼▼
    ////         // yield a              return [0, 1]
    ////         // ~~~~~
    ////         return setReferenceLocation(entry, filePosition, new Range(
    ////             document.positionAt(token.parent.getStart()),
    ////             document.positionAt(token.parent.expression?.getFullStart() ?? token.parent.getEnd())
    ////         ));
    ////     }
    ////     if (token.kind === ts.SyntaxKind.DotDotDotToken) {
    ////         //  ▼▼▼
    ////         // [...a]
    ////         //  ~~~
    ////         //
    ////         //   ▼▼▼
    ////         // f(...a)
    ////         //   ~~~
    ////         return setReferenceLocationFromNode(entry, filePosition, document, token);
    ////     }
    ////     if (token.kind === ts.SyntaxKind.Identifier) {
    ////         if (ts.isEnumMember(token.parent)) {
    ////             return setReferenceLocationFromNode(entry, filePosition, document, token);
    ////         }
    ////     }
    ////     if (token.kind === ts.SyntaxKind.OpenParenToken) {
    ////         if (ts.isIfStatement(token.parent) ||
    ////             ts.isSwitchStatement(token.parent) ||
    ////             ts.isWhileStatement(token.parent) ||
    ////             ts.isDoStatement(token.parent) ||
    ////             ts.isWithStatement(token.parent) ||
    ////             ts.isParenthesizedExpression(token.parent)) {
    ////             //             ▼
    ////             //          if (a.b) {}
    ////             //      switch (a.b) {}
    ////             //       while (a.b) {}
    ////             // do {} while (a.b)
    ////             //        with (a.b) {}
    ////             //             (a.b) {}
    ////             //                ~
    ////             if (setReferenceLocation(entry, filePosition, getRangeForLoadICExpression(document, token.parent.expression, worst.key))) {
    ////                 return true;
    ////             }
    ////         }
    ////         if (ts.isForStatement(token.parent) && token.parent.initializer) {
    ////             //     ▼
    ////             // for (a.b;;) {}
    ////             //        ~
    ////             if (setReferenceLocation(entry, filePosition, getRangeForLoadICExpression(document, token.parent.initializer, worst.key))) {
    ////                 return true;
    ////             }
    ////         }
    ////     }
    ////     if (ts.isBinaryExpression(token.parent) &&
    ////         token.parent.operatorToken.kind === ts.SyntaxKind.InKeyword) {
    ////         //   ▼▼
    ////         // a in b
    ////         //   ~~
    ////         return setReferenceLocationFromNode(entry, filePosition, document, token.parent.operatorToken);
    ////     }
    ////
    ////     // worst case. walk up tree to find an access-like expression
    ////     let node: ts.Node = token;
    ////     while (ts.isExpression(node.parent) &&
    ////         !ts.isPropertyAccessExpression(node.parent) &&
    ////         !ts.isElementAccessExpression(node.parent) &&
    ////         !ts.isCallExpression(node.parent) &&
    ////         !ts.isNonNullExpression(node.parent) &&
    ////         !ts.isPrefixUnaryExpression(node.parent) &&
    ////         !ts.isPostfixUnaryExpression(node.parent) &&
    ////         !ts.isObjectLiteralExpression(node.parent) &&
    ////         !ts.isParenthesizedExpression(node.parent) &&
    ////         !ts.isArrayLiteralExpression(node.parent) &&
    ////         !ts.isTemplateExpression(node.parent)) {
    ////         node = node.parent;
    ////     }
    ////     if (ts.isPropertyAccessExpression(node.parent) ||
    ////         ts.isElementAccessExpression(node.parent)) {
    ////         return setReferenceLocation(entry, filePosition, getRangeForAccessExpression(document, node.parent, worst.key));
    ////     }
    ////     if (ts.isCallExpression(node.parent) ||
    ////         ts.isTemplateSpan(node.parent) ||
    ////         token.kind === ts.SyntaxKind.ExclamationToken && ts.isNonNullExpression(node.parent)) {
    ////         if (setReferenceLocation(entry, filePosition, getRangeForLoadICExpression(document, node.parent.expression, worst.key))) {
    ////             return true;
    ////         }
    ////     }
    ////     if (ts.isTemplateExpression(node.parent)) {
    ////         if (setReferenceLocation(entry, filePosition, getRangeForLoadICExpression(document, node.parent.templateSpans[0].expression, worst.key))) {
    ////             return true;
    ////         }
    ////     }
    ////     if (ts.isPrefixUnaryExpression(node.parent) ||
    ////         ts.isPostfixUnaryExpression(node.parent)) {
    ////         if (setReferenceLocation(entry, filePosition, getRangeForLoadICExpression(document, node.parent.operand, worst.key))) {
    ////             return true;
    ////         }
    ////     }
    ////     if (ts.isIdentifier(token)) {
    ////         return setReferenceLocation(entry, filePosition, getRangeForAccessLikeIdentifier(document, token, worst.key));
    ////     }
    //// }
    //// else if (worst?.type === "StoreInArrayLiteralIC") {
    ////     if (token.kind === ts.SyntaxKind.OpenParenToken &&
    ////         ts.isCallExpression(token.parent) &&
    ////         token.parent.arguments.length) {
    ////         const last = token.parent.arguments[token.parent.arguments.length - 1];
    ////         if (ts.isSpreadElement(last)) {
    ////             // downleveled spread in call/new
    ////             return setReferenceLocation(entry, filePosition, new Range(
    ////                 document.positionAt(last.getStart()),
    ////                 document.positionAt(last.expression.getFullStart())
    ////             ));
    ////         }
    ////     }
    ////
    ////     // let node: ts.Node = token;
    ////     // while (ts.isExpression(node.parent) &&
    ////     //     !ts.isArrayLiteralExpression(node.parent) &&
    ////     //     !ts.isYieldExpression(node.parent)) {
    ////     //     node = node.parent;
    ////     // }
    ////     // if (ts.isArrayLiteralExpression(node.parent)) {
    ////     //     return getRangeForNode(document, node);
    ////     // }
    ////     // if (ts.isYieldExpression(node.parent)) { // downleveled yield
    ////     //     return new Range(
    ////     //         document.positionAt(node.parent.getStart()),
    ////     //         document.positionAt(node.parent.expression?.getFullStart() ?? node.parent.getEnd())
    ////     //     );
    ////     // }
    //// }
    //// else if (worst?.type === IcType.LoadGlobalIC) {
    ////     if (token.kind === ts.SyntaxKind.ReturnKeyword && ts.isReturnStatement(token.parent) && token.parent.expression) {
    ////         const returnExprToken = ts.getTokenAtPosition(document.sourceFile, token.parent.expression.getStart());
    ////         if (returnExprToken.kind === ts.SyntaxKind.Identifier) {
    ////             return setReferenceLocationFromNode(entry, filePosition, document, returnExprToken);
    ////         }
    ////     }
    ////     if (token.kind === ts.SyntaxKind.Identifier) {
    ////         return setReferenceLocationFromNode(entry, filePosition, document, token);
    ////     }
    //// }
    ////
    //// return false;
}

function tryResolveIcLocationInTypeScript(locationKind: LocationKind, entry: IcEntry, filePosition: Location, document: TextDocumentLike, sourceFile: ts.SourceFile): boolean {
    assert(locationKind === "source");
    if (entry.generatedReferenceLocation) {
        const sourceMap = entry.getSourceMap();
        if (sourceMap) {
            const location = sourceMap.toSourceLocation(entry.generatedReferenceLocation);
            if (location) {
                if (location.range.isEmpty) {
                    if (tryResolveIcLocationInJavaScript(locationKind, entry, filePosition, document, sourceFile)) {
                        return true;
                    }
                }
                return setReferenceLocation(locationKind, entry, location);
            }
        }
    }
    return false;
}

function tryResolveIcLocations(locationKind: LocationKind, entry: IcEntry, filePosition: Location, document: TextDocumentLike, sourceFile: ts.SourceFile): boolean {
    if (isJavaScriptFile(filePosition.uri)) {
        return tryResolveIcLocationInJavaScript(locationKind, entry, filePosition, document, sourceFile);
    }
    if (isTypeScriptFile(filePosition.uri)) {
        return tryResolveIcLocationInTypeScript(locationKind, entry, filePosition, document, sourceFile);
    }
    return false;
}

export function resolveIcLocations(locationKind: LocationKind, entry: IcEntry) {
    return resolveLocations(locationKind, entry, tryResolveIcLocations);
}

// #endregion IcEntry Locations

// #region DeoptEntry Locations

const wrongMapRegExp = /wrong map/i;
const wrongCallTargetRegExp = /wrong call/i;
const notAnSmiRegExp = /not.*smi/i;
const binaryTypeFeedbackRegExp = /type feedback.*(binary|compare)/;
const unaryTypeFeedbackRegExp = /type feedback.*unary/;
const callTypeFeedbackRegExp = /type feedback.*call/;
const genericTypeFeedbackRegExp = /type feedback.*generic/;

function tryResolveDeoptLocationInJavaScript(locationKind: LocationKind, entry: DeoptEntry, filePosition: Location, document: TextDocumentLike, sourceFile: ts.SourceFile): boolean {
    const token = tokenAt(sourceFile, filePosition.range.start);
    const worst = from(entry.updates).minBy(update => update.bailoutType);
    if (worst?.bailoutType === DeoptimizeKind.Eager && wrongCallTargetRegExp.test(worst.deoptReason) ||
        worst?.bailoutType === DeoptimizeKind.Soft && callTypeFeedbackRegExp.test(worst.deoptReason)) {
        let node = token;
        while (node && !ts.isStatement(node)) {
            if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
                node = node.expression;
                while (ts.isParenthesizedExpression(node)) {
                    node = node.expression;
                }
                return setReferenceLocationFromNode(locationKind, entry, document, node);
            }
            else if (ts.isTaggedTemplateExpression(node)) {
                node = node.tag;
                while (ts.isParenthesizedExpression(node)) {
                    node = node.expression;
                }
                return setReferenceLocationFromNode(locationKind, entry, document, node);
            }
            node = node.parent;
        }
    }
    else if (worst?.bailoutType === DeoptimizeKind.Eager && notAnSmiRegExp.test(worst.deoptReason)) {
        let node = token;
        while (node && !ts.isStatement(node)) {
            if (ts.isBinaryExpression(node)) {
                return setReferenceLocationFromNode(locationKind, entry, document, node.operatorToken);
            }
            if (ts.isPropertyAccessExpression(node)) {
                return setReferenceLocationFromNode(locationKind, entry, document, node.name);
            }
            if (ts.isElementAccessExpression(node)) {
                return setReferenceLocationFromNode(locationKind, entry, document, node.argumentExpression);
            }
            node = node.parent;
        }
    }
    else if (worst?.bailoutType === DeoptimizeKind.Soft && binaryTypeFeedbackRegExp.test(worst.deoptReason)) {
        let node = token;
        while (node && !ts.isStatement(node)) {
            if (ts.isBinaryExpression(node)) {
                return setReferenceLocationFromNode(locationKind, entry, document, node.operatorToken);
            }
            node = node.parent;
        }
    }
    else if (worst?.bailoutType === DeoptimizeKind.Soft && unaryTypeFeedbackRegExp.test(worst.deoptReason)) {
        let node = token;
        while (node && !ts.isStatement(node)) {
            if (ts.isPrefixUnaryExpression(node)) {
                const operatorToken = ts.factory.createToken(node.operator);
                ts.setTextRange(operatorToken, { pos: node.pos, end: node.operand.end });
                ts.setParent(operatorToken, node.parent);
                return setReferenceLocationFromNode(locationKind, entry, document, operatorToken);
            }
            if (ts.isPostfixUnaryExpression(node)) {
                const operatorToken = ts.factory.createToken(node.operator);
                ts.setTextRange(operatorToken, { pos: node.operand.end, end: node.end });
                ts.setParent(operatorToken, node.parent);
                return setReferenceLocationFromNode(locationKind, entry, document, operatorToken);
            }
            node = node.parent;
        }
    }


    let node = token;
    while (node && !ts.isStatement(node)) {
        if (ts.isPropertyAccessExpression(node)) {
            return setReferenceLocationFromNode(locationKind, entry, document, node.name);
        }
        if (ts.isElementAccessExpression(node)) {
            return setReferenceLocationFromNode(locationKind, entry, document, node.argumentExpression);
        }
        if (ts.isNewExpression(node)) {
            if (ts.isPropertyAccessExpression(node.expression)) {
                return setReferenceLocationFromNode(locationKind, entry, document, node.expression.name);
            }
            if (ts.isElementAccessExpression(node.expression)) {
                return setReferenceLocationFromNode(locationKind, entry, document, node.expression.argumentExpression);
            }
            if (ts.isIdentifier(node.expression)) {
                return setReferenceLocationFromNode(locationKind, entry, document, node.expression);
            }
        }
        node = node.parent;
    }

    if (ts.isIdentifier(token)) {
        return setReferenceLocationFromNode(locationKind, entry, document, token);
    }

    return false;

    // TODO(rbuckton): This is old logic that I've preserved in case I need to reintroduce it...
    //// const preceedingToken = ts.findPrecedingToken(offset, document.sourceFile, undefined, true);
    //// const worst = from(entry.updates).minBy(update => update.bailoutType);
    //// if (worst?.bailoutType === DeoptimizeKind.Lazy) {
    ////     // TODO(rbuckton): Consider inserting a synthetic text entry indicating the deopt as a `before` decoration...
    ////     // lazy bailouts are often found in case clauses and control flow blocks
    ////     if (preceedingToken?.kind === ts.SyntaxKind.ColonToken &&
    ////         ts.isCaseOrDefaultClause(preceedingToken.parent)) {
    ////         if (ts.isCaseClause(preceedingToken.parent)) {
    ////             const start = document.positionAt(preceedingToken.parent.getStart());
    ////             const end = start.translate({ characterDelta: "case".length });
    ////             return setReferenceLocation(entry, filePosition, new Range(start, end));
    ////         }
    ////         if (ts.isDefaultClause(preceedingToken.parent)) {
    ////             const start = document.positionAt(preceedingToken.parent.getStart());
    ////             const end = start.translate({ characterDelta: "default".length });
    ////             return setReferenceLocation(entry, filePosition, new Range(start, end));
    ////         }
    ////     }
    ////     if (preceedingToken?.kind === ts.SyntaxKind.OpenBraceToken &&
    ////         ts.isBlock(preceedingToken.parent)) {
    ////         if (ts.isCaseClause(preceedingToken.parent.parent)) {
    ////             const start = document.positionAt(preceedingToken.parent.parent.getStart());
    ////             const end = start.translate({ characterDelta: "case".length });
    ////             return setReferenceLocation(entry, filePosition, new Range(start, end));
    ////         }
    ////         if (ts.isDefaultClause(preceedingToken.parent.parent)) {
    ////             const start = document.positionAt(preceedingToken.parent.parent.getStart());
    ////             const end = start.translate({ characterDelta: "default".length });
    ////             return setReferenceLocation(entry, filePosition, new Range(start, end));
    ////         }
    ////     }
    //// }
    //// if (token.kind === ts.SyntaxKind.EqualsToken) {
    ////     return setReferenceLocationFromNode(entry, filePosition, document, token);
    //// }
    //// if (preceedingToken?.kind === ts.SyntaxKind.EqualsToken && ts.isVariableDeclaration(preceedingToken.parent)) {
    ////     return setReferenceLocationFromNode(entry, filePosition, document, preceedingToken);
    //// }
    //// if (token.kind === ts.SyntaxKind.DotToken && ts.isPropertyAccessExpression(token.parent)) {
    ////     return setReferenceLocationFromNode(entry, filePosition, document, token.parent.expression);
    //// }
    //// if (preceedingToken?.kind === ts.SyntaxKind.CloseParenToken && ts.isParenthesizedExpression(preceedingToken.parent) &&
    ////     ts.isPropertyAccessExpression(preceedingToken.parent.parent)) {
    ////     return setReferenceLocationFromNode(entry, filePosition, document, preceedingToken.parent.parent);
    //// }
    //// if (ts.isBinaryExpression(token.parent) && token.parent.operatorToken === token) {
    ////     return setReferenceLocationFromNode(entry, filePosition, document, token);
    //// }
    //// if (ts.isIdentifier(token)) {
    ////     return setReferenceLocation(entry, filePosition, getRangeForAccessLikeIdentifier(document, token));
    //// }
    //// // TODO(rbuckton): Do these need adjustments?
    //// return false;
}

function tryResolveDeoptLocationInTypeScript(locationKind: LocationKind, entry: DeoptEntry, filePosition: Location, document: TextDocumentLike, sourceFile: ts.SourceFile): boolean {
    if (entry.generatedReferenceLocation) {
        const sourceMap = entry.getSourceMap();
        if (sourceMap) {
            const location = sourceMap.toSourceLocation(entry.generatedReferenceLocation);
            if (location) {
                if (location.range.isEmpty) {
                    if (tryResolveDeoptLocationInJavaScript(locationKind, entry, filePosition, document, sourceFile)) {
                        return true;
                    }
                }
                return setReferenceLocation(locationKind, entry, location);
            }
        }
    }
    return false;
}

function tryResolveDeoptLocations(locationKind: LocationKind, entry: DeoptEntry, filePosition: Location, document: TextDocumentLike, sourceFile: ts.SourceFile): boolean {
    if (isJavaScriptFile(filePosition.uri)) {
        return tryResolveDeoptLocationInJavaScript(locationKind, entry, filePosition, document, sourceFile);
    }
    if (isTypeScriptFile(filePosition.uri)) {
        return tryResolveDeoptLocationInTypeScript(locationKind, entry, filePosition, document, sourceFile);
    }
    return false;
}

export function resolveDeoptLocations(locationKind: LocationKind, entry: DeoptEntry) {
    return resolveLocations(locationKind, entry, tryResolveDeoptLocations);
}

// #endregion DeoptEntry Locations
