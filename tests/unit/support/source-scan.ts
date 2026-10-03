import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

/**
 * Source scanning for the coverage tests that hold every route to a boundary:
 * the origin guard (#45) and the rate limiter (#46).
 *
 * Reading source is I/O, but it is the repository's own files rather than a
 * service, and the unit suite's refusal of network and database access still
 * holds.
 */

export const ROOT = path.resolve(__dirname, "../../..");
export const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface Handler {
  method: string;
  /** The parsed function, or null when the export form hides its body. */
  fn: ts.FunctionDeclaration | null;
}

export function parse(file: string, source: string): ts.SourceFile {
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

export function isExported(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  );
}

/** Names bound by a variable declaration, including destructuring. */
export function boundNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : boundNames(element.name)
  );
}

/** Every exported mutating handler in a route module. */
export function mutatingHandlers(source: ts.SourceFile): Handler[] {
  const handlers: Handler[] = [];

  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && isExported(statement)) {
      const method = statement.name?.text ?? "";
      if (MUTATING.has(method)) handlers.push({ method, fn: statement });
    } else if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        for (const method of boundNames(declaration.name)) {
          if (MUTATING.has(method)) handlers.push({ method, fn: null });
        }
      }
    } else if (ts.isExportDeclaration(statement) && statement.exportClause) {
      if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          if (MUTATING.has(element.name.text)) handlers.push({ method: element.name.text, fn: null });
        }
      }
    }
  }

  return handlers;
}

/** Every call to `callee` anywhere inside `node`. */
export function callsTo(node: ts.Node, callee: string): number {
  let count = 0;
  const visit = (child: ts.Node) => {
    if (
      ts.isCallExpression(child) &&
      ts.isIdentifier(child.expression) &&
      child.expression.text === callee
    ) {
      count += 1;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return count;
}

// The only filesystem access in the coverage tests. Every path is the repository's own:
// a fixed directory name, an entry from the exemption list, or a name returned
// by the directory walk. None comes from input, which is what the
// non-literal-filename rule exists to catch.
export function exists(file: string): boolean {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- repository path, see above
  return existsSync(path.join(ROOT, file));
}

export const read = (file: string) =>
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- repository path, see above
  readFileSync(path.join(ROOT, file), "utf8");

export function walk(dir: string, accept: (file: string) => boolean): string[] {
  if (!exists(dir)) return [];
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- repository path, see above
  return (readdirSync(path.join(ROOT, dir), { recursive: true }) as string[])
    .map((relative) => path.join(dir, relative).split(path.sep).join("/"))
    .filter(accept)
    .sort();
}
