/**
 * Repository documentation consistency check.
 *
 * The source-of-truth documents (PRODUCT.md, DESIGN.md, CONTEXT.md, the ADRs,
 * the policies, the AI documents, and the release matrix) cite files, Prisma
 * models, npm scripts, and each other. Nothing stops a rename from turning one
 * of those citations into a lie, and a source of truth that quietly goes stale
 * is worse than none.
 *
 * Run: npm run test:checks
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = process.cwd();

const docs = [
  "PRODUCT.md", "DESIGN.md", "CONTEXT.md", "README.md", "AGENTS.md", "CLAUDE.md",
  ...listMarkdown("docs/agents"),
  ...listMarkdown("docs/adr"),
  ...listMarkdown("docs/policies"),
  ...listMarkdown("docs/ai"),
  ...listMarkdown("docs/release"),
  "evals/README.md",
].filter((f) => fs.existsSync(path.join(root, f)));

function listMarkdown(dir) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter((f) => f.endsWith(".md")).map((f) => path.join(dir, f));
}

// Paths the documents deliberately name as absent.
const KNOWN_ABSENT = new Set([
  "vercel.json",        // policy 02 and 08 name it as not configured
  "loading.tsx",        // the matrix records that none exists, which is the finding
  "dataset.v2.jsonl",   // evals/README.md describes the future major-version filename
]);

function slugify(heading) {
  // Matches GitHub: strip punctuation, lowercase, each remaining space becomes a dash.
  return heading.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s/g, "-");
}

test("relative document links resolve to a real file", () => {
  const errors = [];
  for (const doc of docs) {
    const src = fs.readFileSync(path.join(root, doc), "utf8");
    const dir = path.dirname(path.join(root, doc));
    for (const m of src.matchAll(/\[[^\]]*\]\((?!https?:)([^)#]+)(#[^)]*)?\)/g)) {
      if (!fs.existsSync(path.resolve(dir, m[1]))) errors.push(`${doc}: dead link -> ${m[1]}`);
    }
  }
  assert.deepEqual(errors, [], errors.join("\n"));
});

test("document link anchors resolve to a real heading", () => {
  const errors = [];
  for (const doc of docs) {
    const src = fs.readFileSync(path.join(root, doc), "utf8");
    const dir = path.dirname(path.join(root, doc));
    for (const m of src.matchAll(/\[[^\]]*\]\((?!https?:)([^)#]+)(#[^)]+)\)/g)) {
      const target = path.resolve(dir, m[1]);
      if (!fs.existsSync(target)) continue;
      const headings = new Set(
        [...fs.readFileSync(target, "utf8").matchAll(/^#{1,6}\s+(.+)$/gm)].map(([, h]) => slugify(h))
      );
      if (!headings.has(m[2].slice(1))) errors.push(`${doc}: dead anchor -> ${m[1]}${m[2]}`);
    }
  }
  assert.deepEqual(errors, [], errors.join("\n"));
});

test("repository paths cited in documents exist", () => {
  const errors = [];
  const pattern = /`((?:app|lib|components|prisma|docs|scripts|e2e|public|actions|hooks|checks|evals)\/[A-Za-z0-9_./[\]()-]*|[A-Za-z0-9_.-]+\.(?:ts|tsx|mjs|cjs|json|css|prisma|yml|jsonl|md))`/g;
  for (const doc of docs) {
    const src = fs.readFileSync(path.join(root, doc), "utf8");
    const dir = path.dirname(path.join(root, doc));
    for (const m of src.matchAll(pattern)) {
      const p = m[1].replace(/\/$/, "");
      if (KNOWN_ABSENT.has(p) || p.startsWith("NNNN")) continue;
      if (!fs.existsSync(path.join(root, p)) && !fs.existsSync(path.resolve(dir, p))) {
        errors.push(`${doc}: missing path -> ${m[1]}`);
      }
    }
  }
  assert.deepEqual(errors, [], errors.join("\n"));
});

test("Prisma models named in CONTEXT.md exist in the schema", () => {
  const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
  const models = new Set([...schema.matchAll(/^model\s+(\w+)/gm)].map((m) => m[1]));
  const src = fs.readFileSync(path.join(root, "CONTEXT.md"), "utf8");
  const errors = [];
  for (const m of src.matchAll(/Prisma:\s*`(\w+)`/g)) {
    if (!models.has(m[1])) errors.push(`CONTEXT.md: unknown Prisma model -> ${m[1]}`);
  }
  assert.deepEqual(errors, [], errors.join("\n"));
});

test("npm scripts named in documents exist", () => {
  const scripts = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).scripts));
  const errors = [];
  for (const doc of docs) {
    const src = fs.readFileSync(path.join(root, doc), "utf8");
    for (const m of src.matchAll(/npm run ([a-z:]+)/g)) {
      if (!scripts.has(m[1])) errors.push(`${doc}: unknown npm script -> ${m[1]}`);
    }
  }
  assert.deepEqual(errors, [], errors.join("\n"));
});

test("Chapter is not reintroduced as new learner-facing vocabulary", () => {
  // CONTEXT.md marks Chapter as legacy storage and route terminology only.
  // These documents describe the product, so a bare "Chapter" here would be a
  // vocabulary regression. CONTEXT.md and the matrix discuss the legacy term
  // deliberately and are exempt.
  const exempt = new Set(["CONTEXT.md", "docs/release/implementation-matrix.md", "docs/agents/domain.md", "CLAUDE.md", "AGENTS.md", "README.md"]);
  const errors = [];
  for (const doc of docs.filter((d) => !exempt.has(d))) {
    const src = fs.readFileSync(path.join(root, doc), "utf8");
    for (const [i, line] of src.split("\n").entries()) {
      // Ignore code spans and paths, where Chapter is the real storage name.
      const prose = line.replace(/`[^`]*`/g, "");
      if (!/\bChapters?\b/.test(prose)) continue;
      // Naming the Chapter-to-Topic migration is the one legitimate prose use.
      if (/Chapters?[\s-]to[\s-]Topic/i.test(prose)) continue;
      errors.push(`${doc}:${i + 1}: learner-facing use of "Chapter"`);
    }
  }
  assert.deepEqual(errors, [], errors.join("\n"));
});
