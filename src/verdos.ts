import * as ts from 'typescript';
import * as fs from 'fs';

interface Entry {
    fileName?: string,
    name?: string,
    type?: string,
    constructors?: Entry[],
    parameters?: Entry[],
    returnType?: string
};

/** Serialize a symbol into a json object */
function serializeSymbol(symbol: ts.Symbol, checker : ts.TypeChecker): Entry {
    return {
        name: symbol.getName(),
        type: checker.typeToString(checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!))
    };
}

/** Serialize a class symbol information */
function serializeClass(symbol: ts.Symbol, checker : ts.TypeChecker) {
    let details = serializeSymbol(symbol, checker);

    // Get the construct signatures
    let constructorType = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!);
    details.constructors = constructorType.getConstructSignatures().map(p => serializeSignature(p, checker));
    return details;
}

/** Serialize a signature (call or construct) */
function serializeSignature(signature: ts.Signature, checker : ts.TypeChecker) {
    return {
        parameters: signature.parameters.map(p => serializeSymbol(p, checker)),
        returnType: checker.typeToString(signature.getReturnType())
    };
}

//Checkes if Symbol is exported
function isNodeExported(node: ts.Node): boolean {
    return ((ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0) ||
           (!!node.parent && node.parent.kind === ts.SyntaxKind.SourceFile) ||
           (!!node.parent && node.parent.kind === ts.SyntaxKind.ClassDeclaration && ((ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0) );
}

///Visits Symbol
function visit(node: ts.Node, checker : ts.TypeChecker, output : Entry[]) {
    if (!isNodeExported(node)) {
        return;
    }

    if (ts.isClassDeclaration(node) && node.name) {
        // This is a top level class, get its symbol
        let symbol = checker.getSymbolAtLocation(node.name);
        if (symbol) {
            output.push(serializeClass(symbol, checker));
        }
        // No need to walk any further, class expressions/inner declarations
        // cannot be exported
    }
    else if (ts.isFunctionDeclaration(node) && node.name) {
        let symbol = checker.getSymbolAtLocation(node.name);
        if (symbol) {
            output.push(serializeSymbol(symbol, checker));
        }
    }
    else if (ts.isModuleDeclaration(node)) {
        // This is a namespace, visit its children
        ts.forEachChild(node,  n => (visit(n, checker, output)));
    }
}

function parse(fileNames: string[], opts: ts.CompilerOptions) : Entry[] {
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
    let output = parse(args, {
        target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS
    })
    fs.writeFileSync('test.json', JSON.stringify(output, undefined, 4))
}
