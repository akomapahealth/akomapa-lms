/**
 * Structural validation of the Phase 1 to 5 implementation matrix.
 *
 * The matrix is only useful if its claims stay honest. A hand-written summary
 * in an earlier draft of this document was wrong, so the counts are asserted
 * from the tables rather than trusted, and every row that claims incompleteness
 * must name who owns it.
 *
 * Run: npm run test:checks
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = process.cwd();
const file = "docs/release/implementation-matrix.md";
const src = fs.readFileSync(path.join(root, file), "utf8");

const STATUSES = ["verified", "partial", "missing", "superseded", "deferred"];

const rows = src
  .split("\n")
  .filter((l) => /^\| \d+\.\d+ \|/.test(l))
  .map((l) => {
    const c = l.split("|").map((x) => x.trim());
    return { id: c[1], requirement: c[2], status: c[3].replace(/`/g, ""), evidence: c[4], owner: c[5] };
  });

test("the matrix has rows for every phase", () => {
  assert.ok(rows.length >= 80, `expected at least 80 rows, found ${rows.length}`);
  for (const phase of [1, 2, 3, 4, 5]) {
    assert.ok(rows.some((r) => r.id.startsWith(`${phase}.`)), `no rows for phase ${phase}`);
  }
});

test("row ids are unique", () => {
  const seen = new Set();
  for (const r of rows) {
    assert.ok(!seen.has(r.id), `duplicate row id ${r.id}`);
    seen.add(r.id);
  }
});

test("every status is from the documented vocabulary", () => {
  for (const r of rows) {
    assert.ok(STATUSES.includes(r.status), `row ${r.id}: unknown status "${r.status}"`);
  }
});

test("every row states its requirement and its evidence", () => {
  for (const r of rows) {
    assert.ok(r.requirement.length > 5, `row ${r.id}: requirement is too thin to review`);
    assert.ok(r.evidence.length > 10, `row ${r.id}: evidence is too thin to review`);
  }
});

// The point of the matrix: an incomplete item must name who closes it, or it is
// just a complaint.
test("partial and missing rows name an owning issue", () => {
  const orphans = rows
    .filter((r) => r.status === "partial" || r.status === "missing")
    .filter((r) => !/issues\/\d+/.test(r.owner));
  assert.deepEqual(orphans.map((r) => r.id), [], "rows with no owning issue");
});

test("superseded rows cite the decision that supersedes them", () => {
  const orphans = rows
    .filter((r) => r.status === "superseded")
    .filter((r) => !/(adr|policies|CONTEXT|PRODUCT|DESIGN)/i.test(r.owner));
  assert.deepEqual(orphans.map((r) => r.id), [], "superseded rows with no decision link");
});

test("deferred rows record a reason", () => {
  for (const r of rows.filter((r) => r.status === "deferred")) {
    assert.ok(r.owner.length > 10, `row ${r.id}: deferred without a recorded reason`);
  }
});

test("the summary counts match the tables", () => {
  const actual = rows.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});
  const summary = {};
  for (const m of src.matchAll(/^\| `(\w+)` \| (\d+) \|$/gm)) summary[m[1]] = Number(m[2]);
  const totalMatch = src.match(/^\| \*\*Total\*\* \| \*\*(\d+)\*\* \|$/m);
  assert.ok(totalMatch, "the summary has no total row");

  for (const status of STATUSES) {
    assert.equal(
      summary[status] ?? 0,
      actual[status] ?? 0,
      `summary claims ${summary[status] ?? 0} ${status} rows, tables contain ${actual[status] ?? 0}`
    );
  }
  assert.equal(Number(totalMatch[1]), rows.length, "summary total does not match the number of rows");
});

test("the release checklist exists and names every gate", () => {
  const checklist = fs.readFileSync(path.join(root, "docs/release/v1-release-checklist.md"), "utf8");
  for (const gate of [
    "Security and authorization", "Data integrity", "Testing", "Accessibility",
    "Recovery and operations", "Deployment and release", "Policy, product, and human decisions",
  ]) {
    assert.ok(checklist.includes(gate), `release checklist is missing the "${gate}" gate`);
  }
});
