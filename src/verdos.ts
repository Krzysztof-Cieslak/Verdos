import * as ts from 'typescript';
import * as fs from 'fs';

export interface Symbol {
    name?: string,
    type: string,
    kind?: string
}

interface Function extends Symbol {
    parameters?: Symbol[],
    returnType?: string
}

interface Class extends Symbol {
    constructors?: Function[],
    members?: Symbol[]
};


/** Serialize a symbol into a json object */
function serializeSymbol(symbol: ts.Symbol, checker: ts.TypeChecker): Symbol {
    return {
        name: symbol.getName(),
        type: checker.typeToString(checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!))
    };
}

/** Serialize a function symbol information */
function serializeFunction(symbol: ts.Symbol, checker: ts.TypeChecker): Function {
    let details: Function = serializeSymbol(symbol, checker);

    let constructorType = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!);
    let signature = constructorType.getCallSignatures()[0];
    details.parameters = signature.parameters.map(p => serializeSymbol(p, checker))
    details.returnType = checker.typeToString(signature.getReturnType())
    return details;
}

/** Serialize a function symbol information */
function serializeConstructor(signature: ts.Signature, checker: ts.TypeChecker): Function {
    return {
        type: checker.typeToString(signature.getReturnType()),
        parameters: signature.parameters.map(p => serializeSymbol(p, checker)),
        returnType: checker.typeToString(signature.getReturnType())
    };
}

/** Serialize a class symbol information */
function serializeClass(symbol: ts.Symbol, checker: ts.TypeChecker): Class {
    let details: Class = serializeSymbol(symbol, checker);
    // Get the construct signatures
    let constructorType = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!);
    details.constructors = constructorType.getConstructSignatures().map(p => serializeConstructor(p, checker));
    return details;
}

/** Serialize a class symbol information */
function serializeType(symbol: ts.Symbol, checker: ts.TypeChecker): Class {
    let details: Class = serializeSymbol(symbol, checker);
    // Get the construct signatures
    return details;
}


/** Checkes if Symbol is exported */
function isNodeExported(node: ts.Node): boolean {
    return ((ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0) || ((ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Public) !== 0);
}

function visitFunction(node: ts.FunctionDeclaration | ts.MethodDeclaration, checker: ts.TypeChecker): Function {
    let symbol = checker.getSymbolAtLocation(node.name);
    if (symbol) {
        return serializeFunction(symbol, checker);
    }
}

function visitProperty(node: ts.PropertyLikeDeclaration | ts.VariableLikeDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration, checker: ts.TypeChecker): Symbol {
    let symbol = checker.getSymbolAtLocation(node.name);
    if (symbol) {
        return serializeSymbol(symbol, checker);
    }
}

function visitClass(node: ts.ClassDeclaration, checker: ts.TypeChecker): Class {
    let symbol = checker.getSymbolAtLocation(node.name);
    if (symbol) {
        let cls = serializeClass(symbol, checker);
        let output = [];
        ts.forEachChild(node, n => (visit(n, checker, output)));
        cls.members = output;
        return cls;
    }
}

function visitInterface(node: ts.InterfaceDeclaration, checker: ts.TypeChecker): Class {
    let symbol = checker.getSymbolAtLocation(node.name);
    if (symbol) {
        let cls = serializeType(symbol, checker)
        let output = [];
        ts.forEachChild(node, n => (visit(n, checker, output)));
        cls.members = output;
        return cls;
    }
}


/** Visits Symbol */
function visit(node: ts.Node, checker: ts.TypeChecker, output: Symbol[]) {
    if (!isNodeExported(node)) {
        return;
    }

    if (ts.isClassDeclaration(node) && node.name) {
        let x = visitClass(node, checker);
        x.kind = "class"
        output.push(x);
    }
    else if (ts.isFunctionDeclaration(node) && node.name) {
        let x = visitFunction(node, checker);
        x.kind = "function"
        output.push(x);
    }
    else if (ts.isMethodDeclaration(node) && node.name) {
        let x = visitFunction(node, checker);
        x.kind = "method"
        output.push(x);
    }
    else if (ts.isPropertyDeclaration(node) && node.name) {
        let x = visitProperty(node, checker);
        x.kind = "property"
        output.push(x);
    }
    else if (ts.isVariableDeclaration(node) && node.name) {
        let x = visitProperty(node, checker);
        x.kind = "variable"
        output.push(x);
    }
    else if (ts.isGetAccessorDeclaration(node) && node.name) {
        let x = visitProperty(node, checker);
        x.kind = "geter"
        output.push(x);
    }
    else if (ts.isSetAccessorDeclaration(node) && node.name) {
        let x = visitProperty(node, checker);
        x.kind = "seter"
        output.push(x);
    }
    else if (ts.isParameterPropertyDeclaration(node) && node.name) {
        let x = visitProperty(node, checker);
        x.kind = "parameterProperty"
        output.push(x);
    }
    else if (ts.isInterfaceDeclaration(node) && node.name) {
        let x = visitInterface(node, checker);
        x.kind = "interface"
        output.push(x);
    }
    else if (ts.isModuleDeclaration(node)) {
        // This is a namespace, visit its children
        ts.forEachChild(node, n => (visit(n, checker, output)));
    }
}

function parse(fileNames: string[], opts: ts.CompilerOptions): Symbol[] {
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

export class Test {
    public Test() {

    }

    public x = 1

    public name() {
        return ""
    }
}