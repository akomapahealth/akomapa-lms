import ts from "typescript";
import { describe, expect, it } from "vitest";

import { RATE_LIMIT_POLICIES } from "@/lib/rate-limit/policies";

import { mutatingHandlers, parse, read, walk } from "../support/source-scan";

/**
 * Every mutating route is rate limited, with the right policy, in the right
 * place (#46).
 *
 * Read from source with the TypeScript parser, like the origin guard's coverage
 * test, because a limit that one new route forgets is a limit with a hole in it.
 * The build fails when:
 *
 * - a mutating handler never awaits `enforceRateLimit`, or names a policy that
 *   does not exist;
 * - a principal-authenticated handler calls it anywhere but immediately after
 *   the principal is resolved -- before that, the per-user bucket is not the
 *   caller's; later, a resource lookup could make a 429 reveal whether the
 *   resource exists;
 * - a route the issue names moves off its specific policy, for example a
 *   checkout falling back to the generous baseline.
 */

const LIMITER = "enforceRateLimit";

/** The operations #46 names, and the policy each must use. */
const SPECIFIC: Record<string, string> = {
  "app/api/community/posts/route.ts POST": "community.post",
  "app/api/community/posts/[postId]/route.ts PATCH": "community.post",
  "app/api/community/posts/[postId]/comments/route.ts POST": "community.comment",
  "app/api/community/comments/[commentId]/route.ts PATCH": "community.comment",
  "app/api/community/posts/[postId]/like/route.ts POST": "community.react",
  "app/api/community/comments/[commentId]/like/route.ts POST": "community.react",
  "app/api/courses/[courseId]/quizzes/[quizId]/start/route.ts POST": "quiz.start",
  "app/api/courses/[courseId]/quizzes/[quizId]/submit/route.ts POST": "quiz.submit",
  "app/api/courses/[courseId]/checkout/route.ts POST": "checkout.create",
  "app/api/courses/[courseId]/certificate/route.ts POST": "certificate.generate",
  "app/api/uploadthing/route.ts POST": "upload.request",
  "app/api/webhook/route.ts POST": "webhook.stripe",
  "app/api/webhooks/clerk/route.ts POST": "webhook.clerk",
};

/** Handlers that run before authentication and so limit before anything else. */
const PRE_AUTH = new Set([
  "app/api/uploadthing/route.ts POST",
  "app/api/webhook/route.ts POST",
  "app/api/webhooks/clerk/route.ts POST",
]);

interface LimiterCall {
  policy: string | null;
  statement: ts.Statement;
}

/** Every `await enforceRateLimit(req, "<policy>", ...)` inside a function. */
function limiterCalls(fn: ts.Node): LimiterCall[] {
  const calls: LimiterCall[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isExpressionStatement(node) &&
      ts.isAwaitExpression(node.expression) &&
      ts.isCallExpression(node.expression.expression) &&
      ts.isIdentifier(node.expression.expression.expression) &&
      node.expression.expression.expression.text === LIMITER
    ) {
      const [, policy] = node.expression.expression.arguments;
      calls.push({
        policy: policy !== undefined && ts.isStringLiteral(policy) ? policy.text : null,
        statement: node,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(fn);
  return calls;
}

/** Whether the statement right before `call` resolves the principal. */
function followsPrincipal(fn: ts.FunctionDeclaration, call: ts.Statement): boolean {
  const first = fn.body?.statements[0];
  if (first === undefined || !ts.isTryStatement(first)) return false;

  const statements = first.tryBlock.statements;
  const index = statements.indexOf(call);
  if (index < 1) return false;

  return statements[index - 1].getText().includes("await requirePrincipal()");
}

const ROUTE_FILES = walk("app/api", (file) => /\/route\.tsx?$/.test(file));
const handlers = ROUTE_FILES.flatMap((file) =>
  mutatingHandlers(parse(file, read(file))).map((handler) => ({
    id: `${file} ${handler.method}`,
    ...handler,
  }))
);

describe("rate-limit coverage", () => {
  it("finds the mutating handlers", () => {
    expect(handlers.length).toBeGreaterThanOrEqual(51);
    expect(handlers.every((h) => h.fn !== null)).toBe(true);
  });

  it.each(handlers.map((h) => [h.id, h] as const))(
    "%s awaits enforceRateLimit exactly once with a known policy",
    (_id, handler) => {
      const calls = limiterCalls(handler.fn!);

      expect(calls).toHaveLength(1);
      expect(Object.keys(RATE_LIMIT_POLICIES)).toContain(calls[0].policy);
    }
  );

  it.each(handlers.filter((h) => !PRE_AUTH.has(h.id)).map((h) => [h.id, h] as const))(
    "%s limits immediately after resolving the principal",
    (_id, handler) => {
      const [call] = limiterCalls(handler.fn!);

      expect(followsPrincipal(handler.fn!, call.statement)).toBe(true);
      // The per-user bucket is keyed on the server-derived principal.
      expect(call.statement.getText()).toMatch(/\{ userId: (principal\.)?userId \}/);
    }
  );

  it.each(Object.entries(SPECIFIC))("%s uses %s", (id, policy) => {
    const handler = handlers.find((h) => h.id === id);

    expect(handler).toBeDefined();
    expect(limiterCalls(handler!.fn!)[0].policy).toBe(policy);
  });

  it("uses the baseline for everything else", () => {
    const others = handlers
      .filter((h) => !(h.id in SPECIFIC))
      .map((h) => limiterCalls(h.fn!)[0].policy);

    expect(new Set(others)).toEqual(new Set(["write.default"]));
  });

  it("leaves no policy unused except the reserved AI one", () => {
    const used = new Set(handlers.map((h) => limiterCalls(h.fn!)[0].policy));
    const unused = Object.keys(RATE_LIMIT_POLICIES).filter((name) => !used.has(name));

    // ai.request is applied by #71 when an AI route first exists.
    expect(unused).toEqual(["ai.request"]);
  });

  it("tells the learner how long to wait wherever the UI calls a mutation", () => {
    // A 429 shown as "Something went wrong" invites the immediate retry that
    // fails again. Every catch around an axios mutation routes its toast
    // through apiErrorMessage, which reads Retry-After.
    const sources = ["app", "components", "hooks"].flatMap((dir) =>
      walk(dir, (file) => /\.tsx?$/.test(file))
    );
    const unwrapped: string[] = [];
    let checked = 0;

    for (const file of sources) {
      const source = parse(file, read(file));
      const visit = (node: ts.Node) => {
        if (
          ts.isTryStatement(node) &&
          node.catchClause &&
          /axios\.(post|put|patch|delete)/.test(node.tryBlock.getText())
        ) {
          const find = (child: ts.Node) => {
            if (ts.isCallExpression(child) && child.expression.getText() === "toast.error") {
              checked += 1;
              const [argument] = child.arguments;
              const wrapped =
                argument !== undefined &&
                ts.isCallExpression(argument) &&
                argument.expression.getText() === "apiErrorMessage";
              if (!wrapped) unwrapped.push(`${file}: ${child.getText()}`);
            }
            ts.forEachChild(child, find);
          };
          find(node.catchClause.block);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }

    expect(checked).toBeGreaterThanOrEqual(46);
    expect(unwrapped).toEqual([]);
  });

  it("reads the principal for upload limits rather than trusting the request", () => {
    const source = read("app/api/uploadthing/route.ts");

    expect(source).toMatch(/const principal = await getPrincipal\(\);\s+await enforceRateLimit\(req, "upload\.request", \{ userId: principal\?\.userId \}\);/);
  });
});
