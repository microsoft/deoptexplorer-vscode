// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// NOTE(rbuckton): Non-public exports of TypeScript. They could change without warning.
declare module "typescript" {
    function isExpression(node: Node): node is Expression;
    function isStatement(node: Node): node is Statement;
    function isAssignmentExpression(node: Node): node is AssignmentExpression<AssignmentOperatorToken>;
    function moveRangePastModifiers(node: Node): TextRange;
    function skipTrivia(text: string, pos: number, stopAfterLineBreak?: boolean, stopAtComments?: boolean): number;
    function getTokenAtPosition(sourceFile: SourceFile, position: number): Node;
    function findPrecedingToken(position: number, sourceFile: SourceFile, startNode?: Node, excludeJsdoc?: boolean): Node | undefined;
    function computeCommonSourceDirectoryOfFilenames(fileNames: string[], currentDirectory: string, getCanonicalFileName: GetCanonicalFileName): string;
    function setParent<T extends Node>(node: T, parent: Node): T;
    interface SourceFile {
        getPositionOfLineAndCharacter(line: number, character: number, allowEdits?: boolean): number;
    }
    type GetCanonicalFileName = (fileName: string) => string;
}
export {};