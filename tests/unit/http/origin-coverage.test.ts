import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { ORIGIN_GUARD_EXEMPTIONS } from "@/lib/http/origin";

/**
 * Every cookie-authenticated mutation calls the origin guard first (#45).
 *
 * A guard that one new route forgets is a guard with a hole in it, and review
 * is not a reliable way to notice an absent line. This reads the source of
 * every route handler and Server Action with the TypeScript parser and fails
 * the build when:
 *
 * - a mutating handler (POST, PUT, PATCH, DELETE) does not call
 *   `assertTrustedOrigin(req)` as the first statement of its `try` -- before
 *   the principal is resolved or the body read;
 * - a handler is exported in a form this check cannot see into
 *   (`export const POST = ...`, a re-export);
 * - a signature-verified webhook on the exemption list calls the guard, which
 *   would refuse every real delivery, or the list names a handler that no
 *   longer exists;
 * - an exported Server Action does not await `assertTrustedActionOrigin()`
 *   first.
 *
 * Reading source is I/O, but it is the repository's own files rather than a
 * service, and the unit suite's refusal of network and database access still
 * holds.
 */

const ROOT = path.resolve(__dirname, "../../..");
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const GUARD = "assertTrustedOrigin";
const ACTION_GUARD = "assertTrustedActionOrigin";

interface Handler {
  method: string;
  /** The parsed function, or null when the export form hides its body. */
  fn: ts.FunctionDeclaration | null;
}

function parse(file: string, source: string): ts.SourceFile {
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function isExported(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  );
}

/** Names bound by a variable declaration, including destructuring. */
function boundNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : boundNames(element.name)
  );
}

/** Every exported mutating handler in a route module. */
function mutatingHandlers(source: ts.SourceFile): Handler[] {
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

/** Whether `statement` is `<callee>(<arg>)` or `await <callee>(<arg>)`. */
function isCallTo(statement: ts.Statement | undefined, callee: string, arg?: string): boolean {
  if (statement === undefined || !ts.isExpressionStatement(statement)) return false;

  let expression = statement.expression;
  if (ts.isAwaitExpression(expression)) expression = expression.expression;
  if (!ts.isCallExpression(expression)) return false;
  if (!ts.isIdentifier(expression.expression) || expression.expression.text !== callee) {
    return false;
  }
  if (arg === undefined) return expression.arguments.length === 0;

  const [only] = expression.arguments;
  return expression.arguments.length === 1 && ts.isIdentifier(only) && only.text === arg;
}

/**
 * Whether the handler calls the guard on its own request before doing anything
 * else: as the first statement of its body, or of a leading `try`.
 */
function guardsFirst(fn: ts.FunctionDeclaration): boolean {
  const param = fn.parameters[0];
  if (param === undefined || !ts.isIdentifier(param.name)) return false;

  const first = fn.body?.statements[0];
  if (isCallTo(first, GUARD, param.name.text)) return true;

  return (
    first !== undefined &&
    ts.isTryStatement(first) &&
    isCallTo(first.tryBlock.statements[0], GUARD, param.name.text)
  );
}

/** Every call to `callee` anywhere inside `node`. */
function callsTo(node: ts.Node, callee: string): number {
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

function hasUseServer(statements: ts.NodeArray<ts.Statement>): boolean {
  for (const statement of statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) {
      return false;
    }
    if (statement.expression.text === "use server") return true;
  }
  return false;
}

/** The body statements after any directive prologue. */
function afterDirectives(statements: ts.NodeArray<ts.Statement>): ts.Statement[] {
  let index = 0;
  while (
    index < statements.length &&
    ts.isExpressionStatement(statements[index]) &&
    ts.isStringLiteral((statements[index] as ts.ExpressionStatement).expression)
  ) {
    index += 1;
  }
  return statements.slice(index);
}

/**
 * Server Actions that do not await the action guard first: every exported
 * function in a `"use server"` module, and every function with an inline
 * `"use server"` directive anywhere.
 */
function unguardedActions(source: ts.SourceFile): string[] {
  const failures: string[] = [];
  const moduleLevel = hasUseServer(source.statements);

  const check = (name: string, body: ts.ConciseBody | undefined) => {
    if (body === undefined || !ts.isBlock(body)) {
      failures.push(name);
      return;
    }
    if (!isCallTo(afterDirectives(body.statements)[0], ACTION_GUARD)) failures.push(name);
  };

  if (moduleLevel) {
    for (const statement of source.statements) {
      if (!isExported(statement)) continue;
      if (ts.isFunctionDeclaration(statement)) {
        check(statement.name?.text ?? "default", statement.body);
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          const init = declaration.initializer;
          const name = boundNames(declaration.name).join(",");
          if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
            check(name, init.body);
          } else {
            // A Server Action module may export only functions; anything else
            // is an action this check cannot see into.
            failures.push(name);
          }
        }
      }
    }
  }

  const visit = (node: ts.Node) => {
    if (
      (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
      node.body !== undefined &&
      ts.isBlock(node.body) &&
      hasUseServer(node.body.statements)
    ) {
      const name =
        ts.isFunctionDeclaration(node) && node.name ? node.name.text : `inline@${node.pos}`;
      check(name, node.body);
    }
    ts.forEachChild(node, visit);
  };
  if (!moduleLevel) visit(source);

  return failures;
}

// The only filesystem access in this file. Every path is the repository's own:
// a fixed directory name, an entry from the exemption list, or a name returned
// by the directory walk. None comes from input, which is what the
// non-literal-filename rule exists to catch.
function exists(file: string): boolean {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- repository path, see above
  return existsSync(path.join(ROOT, file));
}

const read = (file: string) =>
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- repository path, see above
  readFileSync(path.join(ROOT, file), "utf8");

function walk(dir: string, accept: (file: string) => boolean): string[] {
  if (!exists(dir)) return [];
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- repository path, see above
  return (readdirSync(path.join(ROOT, dir), { recursive: true }) as string[])
    .map((relative) => path.join(dir, relative).split(path.sep).join("/"))
    .filter(accept)
    .sort();
}

const ROUTE_FILES = walk("app/api", (file) => /\/route\.tsx?$/.test(file));
const EXEMPT = new Map<string, (typeof ORIGIN_GUARD_EXEMPTIONS)[number]>(
  ORIGIN_GUARD_EXEMPTIONS.map((entry) => [entry.file, entry])
);

describe("the scanner itself", () => {
  // The coverage assertions below are only as good as the parser that feeds
  // them, so each rule is proven against source it must accept and reject.
  const route = (source: string) => mutatingHandlers(parse("route.ts", source));

  it("accepts the guard as the first statement of a leading try", () => {
    const [handler] = route(`
      export async function POST(req: Request) {
        try { assertTrustedOrigin(req); await work(); } catch (e) { return fail(e); }
      }`);
    expect(guardsFirst(handler.fn!)).toBe(true);
  });

  it("accepts the guard as the first statement of the body", () => {
    const [handler] = route(`export function DELETE(request: Request) { assertTrustedOrigin(request); }`);
    expect(guardsFirst(handler.fn!)).toBe(true);
  });

  it.each([
    ["no guard", `export async function POST(req: Request) { try { await work(); } catch {} }`],
    ["a guard after the principal", `export async function POST(req: Request) { try { await requirePrincipal(); assertTrustedOrigin(req); } catch {} }`],
    ["a guard on another value", `export async function POST(req: Request) { try { assertTrustedOrigin(other); } catch {} }`],
    ["a guard with no argument", `export async function POST(req: Request) { try { assertTrustedOrigin(); } catch {} }`],
    ["a guard inside a condition", `export async function POST(req: Request) { if (x) assertTrustedOrigin(req); }`],
    ["a different function", `export async function POST(req: Request) { try { assertSomething(req); } catch {} }`],
    ["a method call", `export async function POST(req: Request) { try { guard.assertTrustedOrigin(req); } catch {} }`],
    ["no parameter", `export async function POST() { assertTrustedOrigin(req); }`],
    ["a destructured parameter", `export async function POST({ headers }: Request) { assertTrustedOrigin(headers); }`],
    ["an empty body", `export async function PATCH(req: Request) {}`],
  ])("rejects %s", (_label, source) => {
    const [handler] = route(source);
    expect(guardsFirst(handler.fn!)).toBe(false);
  });

  it("finds every mutating export form, and ignores safe methods and non-exports", () => {
    const handlers = route(`
      export async function GET() {}
      async function POST() {}
      export async function PUT(req: Request) {}
      export const PATCH = wrap(handler);
      export const { DELETE, GET: other } = make();
      const POST2 = 1;
      export { POST2 as POST };
      export * from "./elsewhere";
    `);
    expect(handlers.map((h) => [h.method, h.fn === null])).toEqual([
      ["PUT", false],
      ["PATCH", true],
      ["DELETE", true],
      ["POST", true],
    ]);
  });

  it("checks module-level Server Actions", () => {
    const failures = unguardedActions(
      parse(
        "actions.ts",
        `"use server";
         export async function good() { await assertTrustedActionOrigin(); await work(); }
         export async function bad() { await work(); }
         export const goodArrow = async () => { await assertTrustedActionOrigin(); };
         export const badArrow = async () => work();
         export const notAFunction = 1;
         async function internal() {}`
      )
    );
    expect(failures).toEqual(["bad", "badArrow", "notAFunction"]);
  });

  it("checks inline Server Actions", () => {
    const failures = unguardedActions(
      parse(
        "page.tsx",
        `export default function Page() {
           async function save() { "use server"; await assertTrustedActionOrigin(); }
           async function drop() { "use server"; await work(); }
           const anon = async () => { "use server"; await work(); };
           function plain() { await work(); }
           return null;
         }`
      )
    );
    expect(failures).toHaveLength(2);
    expect(failures[0]).toBe("drop");
    expect(failures[1]).toMatch(/^inline@/);
  });

  it("ignores a module whose directive is not use server", () => {
    expect(unguardedActions(parse("c.tsx", `"use client"; export function X() {}`))).toEqual([]);
  });
});

describe("route handlers", () => {
  it("finds the route tree", () => {
    // A path change that empties the scan would pass every test below.
    expect(ROUTE_FILES.length).toBeGreaterThanOrEqual(40);
  });

  const handlers = ROUTE_FILES.flatMap((file) =>
    mutatingHandlers(parse(file, read(file))).map((handler) => ({ file, ...handler }))
  );

  it("exports every mutating handler as a function declaration", () => {
    const hidden = handlers
      .filter((h) => h.fn === null)
      .map((h) => `${h.file} ${h.method}`);
    expect(hidden).toEqual([]);
  });

  const guarded = handlers.filter((h) => !EXEMPT.has(h.file) && h.fn !== null);

  it.each(guarded.map((h) => [`${h.method} ${h.file}`, h] as const))(
    "%s calls assertTrustedOrigin first",
    (_label, handler) => {
      expect(guardsFirst(handler.fn!)).toBe(true);
    }
  );

  it("guards at least the 48 handlers that existed when #45 landed", () => {
    expect(guarded.length).toBeGreaterThanOrEqual(48);
  });
});

describe("exemptions", () => {
  it.each(ORIGIN_GUARD_EXEMPTIONS.map((entry) => [entry.file, entry] as const))(
    "%s exists and exports what the list says",
    (file, entry) => {
      expect(exists(file)).toBe(true);
      const methods = mutatingHandlers(parse(file, read(file))).map((h) => h.method);
      expect(methods).toEqual([...entry.methods]);
      expect(entry.verifiedBy.length).toBeGreaterThan(0);
    }
  );

  it("is documented in docs/security/csrf.md", () => {
    const doc = read("docs/security/csrf.md");
    for (const entry of ORIGIN_GUARD_EXEMPTIONS) {
      expect(doc).toContain(entry.file);
    }
  });

  it.each(
    ORIGIN_GUARD_EXEMPTIONS.filter((entry) => entry.scope === "all").map((entry) => [entry.file])
  )("%s does not call the guard, which would refuse every real delivery", (file) => {
    expect(callsTo(parse(file, read(file)), GUARD)).toBe(0);
  });

  it.each(
    ORIGIN_GUARD_EXEMPTIONS.filter((entry) => entry.scope === "signed-callbacks").map((entry) => [
      entry.file,
    ])
  )("%s guards everything except signed callbacks", (file) => {
    const [handler] = mutatingHandlers(parse(file, read(file)));
    expect(handler.fn).not.toBeNull();
    expect(callsTo(handler.fn!, "isUploadThingServerCallback")).toBe(1);
    expect(callsTo(handler.fn!, GUARD)).toBe(1);
  });

});

describe("Server Actions", () => {
  const sources = ["app", "actions", "components", "hooks", "lib"].flatMap((dir) =>
    walk(dir, (file) => /\.(ts|tsx)$/.test(file) && !file.endsWith(".d.ts"))
  );

  it("scans the source tree", () => {
    expect(sources.length).toBeGreaterThan(100);
  });

  it("guards every Server Action with assertTrustedActionOrigin", () => {
    const failures = sources.flatMap((file) =>
      unguardedActions(parse(file, read(file))).map((name) => `${file} ${name}`)
    );
    expect(failures).toEqual([]);
  });

  it("never widens Next.js's own Server Action origin check", () => {
    // `serverActions.allowedOrigins` relaxes the framework's Origin-vs-Host
    // comparison. Any trusted origin belongs in TRUSTED_ORIGINS instead, where
    // the guard enforces it exactly.
    expect(read("next.config.mjs")).not.toMatch(/allowedOrigins/);
  });
});

describe("browser preconditions", () => {
  it("keeps a Referrer-Policy under which browsers send a real Origin", () => {
    // Under `no-referrer`, some browsers send `Origin: null` on same-origin
    // form posts, which the guard refuses -- every such write would break.
    const config = read("next.config.mjs");
    const policy = config.match(/key:\s*"Referrer-Policy",\s*value:\s*"([^"]+)"/)?.[1];
    expect(policy).toBe("strict-origin-when-cross-origin");
  });
});
