import * as ts from "typescript";

//Checkes if Symbol is exported
function isNodeExported(node: ts.Node): boolean {
    return ((ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0) ||
           (!!node.parent && node.parent.kind === ts.SyntaxKind.SourceFile) ||
           (!!node.parent && node.parent.kind === ts.SyntaxKind.ClassDeclaration && ((ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0) );
}

///Visits Symbol
function visit(node: ts.Node, checker : ts.TypeChecker, output) {
    if (!isNodeExported(node)) {
        return;
    }

    if (ts.isClassDeclaration(node) && node.name) {
        // This is a top level class, get its symbol
        let symbol = checker.getSymbolAtLocation(node.name);
        if (symbol) {
            output.push(serializeClass(symbol));
        }
        // No need to walk any further, class expressions/inner declarations
        // cannot be exported
    }
    else if (ts.isFunctionDeclaration(node) && node.name) {
        let symbol = checker.getSymbolAtLocation(node.name);
        if (symbol) {
            output.push(serializeFunction(symbol));
        }
    }
    else if (ts.isModuleDeclaration(node)) {
        // This is a namespace, visit its children
        ts.forEachChild(node,  n => (visit(n, checker, output)));
    }
}

function parse(fileNames: string[], opts: ts.CompilerOptions) {
    let program = ts.createProgram(fileNames, opts);
    let checker = program.getTypeChecker()

    let output = []
    for (const sourceFile of program.getSourceFiles()) {
        if (!sourceFile.isDeclarationFile) {
            // Walk the tree to search for classes
            ts.forEachChild(sourceFile, n => (visit(n, checker, output)));
        }
    }
    return output;
}

export function main(args: string[]): void {
    parse(args, {
        target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS
    })
    console.log('Hello, world!');
}
