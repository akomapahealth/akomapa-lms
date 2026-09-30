#!/usr/bin/env node
/**
 * Report what is unblocked right now on akomapahealth/akomapa-lms.
 *
 * The authoritative dependency graph is a `## Blocked by` section inside each
 * issue body. GitHub's native dependency API (`/issues/N/dependencies/
 * blocked_by`) returns an empty array for this repository, so it cannot be
 * used. `docs/agents/implementation-order.md` carries the recommended waves;
 * this script answers the narrower question the waves cannot: given what is
 * closed today, what may start now.
 *
 * Nothing here is hardcoded except the structural sets below: the closed set is
 * derived live, so the output cannot go stale the way a written snapshot does.
 *
 * Usage: npm run issues:next [-- --json]
 * Requires the `gh` CLI, authenticated. Not part of `npm run validate`: it
 * needs network and auth, and would fail CI.
 */

import { execFileSync } from "node:child_process";

const REPO = "akomapahealth/akomapa-lms";

/** Epics are containers for other issues, not deliverable work. */
const EPICS = new Set(Array.from({ length: 13 }, (_, i) => 23 + i));

/** Tracked in the `Post-v1 AI & Growth` milestone; must not delay v1. */
const POST_V1 = new Set([91, 92, 93]);

/** The v1 release checklist states these gate the AI feature, not the release. */
const NOT_V1 = new Set([123, 124]);

/**
 * The continuous quality lane. Each of these is "blocked by" the very feature
 * issues it exists to test (#106 by #48/#49/#63/#73/#83/#84), which is circular
 * by construction. `docs/agents/implementation-order.md` resolves this by
 * declaring them a lane that stays open while coverage accumulates, so their
 * edges are dropped from the gating graph. They are still reported, because
 * they are release blockers -- they simply never hold anything else back.
 */
const QUALITY_LANE = new Set([106, 107, 108, 109]);

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function fetchIssues(state) {
  const raw = gh([
    "issue", "list", "--repo", REPO, "--state", state,
    "--limit", "500", "--json", "number,title,labels,body,milestone",
  ]);
  return JSON.parse(raw);
}

/** Parse the `## Blocked by` section, tolerating it being the final section. */
function parseBlockedBy(body) {
  const match = /##\s*Blocked by\s*\n([\s\S]*?)(?=\n##\s|$)/.exec(body ?? "");
  if (!match) return new Set();
  // Prose in this section sometimes explains a correction and cites issues that
  // are no longer blockers, so only count refs before any explicit "Nothing".
  const text = /^\s*Nothing\b/im.test(match[1]) ? "" : match[1];
  return new Set(Array.from(text.matchAll(/#(\d+)/g), (m) => Number(m[1])));
}

function findCycles(deps) {
  const cycles = [];
  const seenEdges = new Set();
  const walk = (node, stack) => {
    for (const parent of deps.get(node) ?? []) {
      const idx = stack.indexOf(parent);
      if (idx !== -1) {
        cycles.push([...stack.slice(idx), parent]);
        continue;
      }
      const edge = `${node}->${parent}`;
      if (seenEdges.has(edge)) continue;
      seenEdges.add(edge);
      walk(parent, [...stack, parent]);
    }
  };
  for (const node of deps.keys()) walk(node, [node]);
  const unique = new Map();
  for (const cycle of cycles) {
    // Key on the unique node set: the same cycle reached from different
    // entry points yields rotations of one list, which must collapse to one.
    unique.set([...new Set(cycle)].sort((a, b) => a - b).join(","), cycle);
  }
  return [...unique.values()];
}

/** Transitive count of issues that cannot start until `target` closes. */
function leverage(target, reverse) {
  const seen = new Set();
  const queue = [target];
  while (queue.length) {
    for (const child of reverse.get(queue.pop()) ?? []) {
      if (!seen.has(child)) {
        seen.add(child);
        queue.push(child);
      }
    }
  }
  return seen.size;
}

const open = fetchIssues("open");
const closed = new Set(fetchIssues("closed").map((i) => i.number));

const titles = new Map();
const deps = new Map();
for (const issue of open) {
  if (EPICS.has(issue.number)) continue;
  titles.set(issue.number, issue.title);
  const blockers = new Set();
  for (const ref of parseBlockedBy(issue.body)) {
    // A ref is only a blocker if it is open, real work, and not the lane.
    if (closed.has(ref) || EPICS.has(ref) || QUALITY_LANE.has(ref)) continue;
    if (!ref || ref === issue.number) continue;
    blockers.add(ref);
  }
  deps.set(issue.number, blockers);
}

// Drop edges pointing at issues that are neither open nor closed (bad refs).
for (const [n, blockers] of deps) {
  for (const b of [...blockers]) if (!deps.has(b)) blockers.delete(b);
  void n;
}

const reverse = new Map();
for (const [n, blockers] of deps) {
  for (const b of blockers) {
    if (!reverse.has(b)) reverse.set(b, new Set());
    reverse.get(b).add(n);
  }
}

const cycles = findCycles(deps);

// Layered topological sort: each layer may be worked in parallel.
const layers = [];
const done = new Set();
for (;;) {
  const ready = [...deps.keys()]
    .filter((n) => !done.has(n) && [...deps.get(n)].every((b) => done.has(b)))
    .sort((a, b) => a - b);
  if (!ready.length) break;
  layers.push(ready);
  for (const n of ready) done.add(n);
}
const stuck = [...deps.keys()].filter((n) => !done.has(n)).sort((a, b) => a - b);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    ready: layers[0] ?? [], layers, cycles, stuck,
    leverage: Object.fromEntries([...deps.keys()].map((n) => [n, leverage(n, reverse)])),
  }, null, 2));
  process.exit(cycles.length || stuck.length ? 1 : 0);
}

const tag = (n) =>
  QUALITY_LANE.has(n) ? " [quality-lane]"
  : POST_V1.has(n) ? " [post-v1]"
  : NOT_V1.has(n) ? " [not-v1]"
  : "";

console.log(`\n${open.length} open, ${closed.size} closed. ` +
  `${deps.size} deliverable (epics ${Math.min(...EPICS)}-${Math.max(...EPICS)} excluded).`);

if (cycles.length) {
  console.log(`\n!! ${cycles.length} DEPENDENCY CYCLE(S) -- these deadlock the graph:`);
  for (const c of cycles) console.log(`   ${c.map((n) => `#${n}`).join(" -> ")}`);
  console.log("   Fix the inverted `Blocked by` on GitHub before trusting the order below.");
}

console.log("\nREADY NOW (no open blockers):");
for (const n of layers[0] ?? []) {
  console.log(`  #${n}${tag(n)}  ${titles.get(n)}`);
}

console.log("\nEARLIEST-START LAYERS (a layer may run in parallel):");
layers.forEach((layer, i) => {
  console.log(`  L${i + 1}: ${layer.map((n) => `#${n}${tag(n)}`).join(" ")}`);
});
if (stuck.length) {
  console.log(`  unordered (cyclic): ${stuck.map((n) => `#${n}`).join(" ")}`);
}

console.log("\nHIGHEST LEVERAGE (issues transitively gated by each):");
const ranked = [...deps.keys()]
  .map((n) => [n, leverage(n, reverse)])
  .filter(([, c]) => c > 0)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12);
for (const [n, count] of ranked) {
  const open_ = (deps.get(n)?.size ?? 0) === 0 ? "ready" : "blocked";
  console.log(`  #${n} gates ${String(count).padStart(2)}  (${open_})  ${titles.get(n)}`);
}

console.log("\nHold to the end regardless of availability: #101 (final visual sign-off), #113 (release gates).");
console.log("Never gate on the quality lane (#106-#109); expand it with every slice.");
console.log("Recommended waves: docs/agents/implementation-order.md\n");
