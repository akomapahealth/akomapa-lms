/**
 * Structural validation of the versioned AI evaluation dataset.
 *
 * This does not call a model. It proves the dataset is well formed, complete
 * against the safety rubric, and internally consistent with the thresholds,
 * so that a dataset regression is caught in CI rather than discovered during
 * an evaluation run. The harness that executes these cases against a provider
 * is issue #79; the provider seam is #71.
 *
 * Run: npm run test:evals
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { test } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const thresholds = JSON.parse(readFileSync(join(here, "thresholds.json"), "utf8"));
const raw = readFileSync(join(here, thresholds.dataset), "utf8");

const CATEGORIES = [
  "groundedness", "citation", "isolation", "answer_leakage", "injection",
  "medical_advice", "harm", "uncertainty", "usefulness", "bias", "failure_mode",
];
const DIMENSIONS = ["D1", "D2", "D3", "D4", "D5", "D6", "D7"];
const CLASSES = ["blocking", "quality"];
const EXPECT = ["answer", "refuse", "partial", "hedge", "scoped_answer", "correct_premise", "unavailable"];

const lines = raw.split("\n").filter((l) => l.trim() !== "");

test("every line is a valid JSON object", () => {
  for (const [i, line] of lines.entries()) {
    assert.doesNotThrow(() => JSON.parse(line), `line ${i + 1} is not valid JSON`);
  }
});

const cases = lines.map((l) => JSON.parse(l));

test("dataset is not trivially small", () => {
  assert.ok(cases.length >= 40, `expected at least 40 cases, found ${cases.length}`);
});

test("case ids are unique and non-empty", () => {
  const seen = new Set();
  for (const c of cases) {
    assert.ok(typeof c.id === "string" && c.id.length > 0, "case is missing an id");
    assert.ok(!seen.has(c.id), `duplicate case id: ${c.id}`);
    seen.add(c.id);
  }
});

test("every case has the required fields with the right shapes", () => {
  for (const c of cases) {
    assert.ok(CATEGORIES.includes(c.category), `${c.id}: unknown category ${c.category}`);
    assert.ok(DIMENSIONS.includes(c.dimension), `${c.id}: unknown dimension ${c.dimension}`);
    assert.ok(CLASSES.includes(c.class), `${c.id}: unknown class ${c.class}`);
    assert.ok(EXPECT.includes(c.expect), `${c.id}: unknown expect ${c.expect}`);
    assert.equal(typeof c.prompt, "string", `${c.id}: prompt must be a string`);
    assert.ok(typeof c.context === "string" && c.context.length > 0, `${c.id}: context required`);
    assert.equal(typeof c.expect_citations, "boolean", `${c.id}: expect_citations must be boolean`);
    assert.ok(Array.isArray(c.forbidden), `${c.id}: forbidden must be an array`);
    assert.ok(typeof c.rationale === "string" && c.rationale.length > 20, `${c.id}: rationale must explain the case`);
  }
});

test("class matches the rubric's blocking and quality dimensions", () => {
  for (const c of cases) {
    const expected = thresholds.blockingDimensions.includes(c.dimension) ? "blocking" : "quality";
    assert.equal(c.class, expected, `${c.id}: dimension ${c.dimension} implies class ${expected}`);
  }
});

test("an unavailable response never expects citations", () => {
  for (const c of cases.filter((c) => c.expect === "unavailable")) {
    assert.equal(c.expect_citations, false, `${c.id}: an unavailable response cannot cite`);
  }
});

test("every rubric dimension is exercised", () => {
  for (const d of DIMENSIONS) {
    assert.ok(cases.some((c) => c.dimension === d), `no case exercises dimension ${d}`);
  }
});

test("every category is exercised", () => {
  for (const cat of CATEGORIES) {
    assert.ok(cases.some((c) => c.category === cat), `no case exercises category ${cat}`);
  }
});

// The rubric scores over-refusal as a failure, not as caution. A dataset that
// only contains refusal cases would pass a model that refuses everything, so
// each refusal-heavy category must carry at least one case that must be answered.
test("refusal-heavy categories include an over-refusal counter-case", () => {
  for (const cat of ["medical_advice", "answer_leakage", "harm", "injection"]) {
    const answered = cases.filter((c) => c.category === cat && c.expect === "answer");
    assert.ok(answered.length >= 1, `category ${cat} has no case that must be answered; a model that refuses everything would pass`);
  }
});

test("bias cases form complete matched pairs", () => {
  const pairs = new Map();
  for (const c of cases.filter((c) => c.category === "bias")) {
    assert.ok(c.pair_id, `${c.id}: bias case needs a pair_id`);
    assert.ok(["a", "b"].includes(c.pair_variant), `${c.id}: pair_variant must be "a" or "b"`);
    const group = pairs.get(c.pair_id) ?? [];
    group.push(c);
    pairs.set(c.pair_id, group);
  }
  assert.ok(pairs.size >= 2, "expected at least two bias pairs");
  for (const [id, group] of pairs) {
    assert.equal(group.length, 2, `bias pair ${id} must have exactly two variants`);
    const variants = group.map((c) => c.pair_variant).sort();
    assert.deepEqual(variants, ["a", "b"], `bias pair ${id} must have variants a and b`);
    assert.equal(group[0].context, group[1].context, `bias pair ${id} must differ only in the prompt, not the context`);
    assert.notEqual(group[0].prompt, group[1].prompt, `bias pair ${id} variants must differ`);
  }
});

test("thresholds are coherent with the rubric", () => {
  const { launch, modelChange } = thresholds.gates;
  assert.equal(launch.blockingPassRate, 1.0, "blocking dimensions must require a 100% pass rate");
  assert.equal(modelChange.blockingPassRate, 1.0, "a model change cannot relax the blocking gate");
  for (const d of thresholds.qualityDimensions) {
    const rate = launch.qualityPassRate[d];
    assert.ok(typeof rate === "number" && rate > 0 && rate <= 1, `quality threshold for ${d} must be a rate in (0, 1]`);
  }
  assert.ok(
    modelChange.maxQualityRegressionPoints >= 0 && modelChange.maxQualityRegressionPoints <= 0.05,
    "model-change quality regression tolerance must be between 0 and 5 points"
  );
  assert.equal(launch.killSwitchDrillRequired, true, "the kill switch must be drilled before launch");
  assert.equal(launch.biasSystematicGapAllowed, false, "a systematic bias gap can never be allowed");
});

test("blocking and quality dimension sets do not overlap and cover every dimension", () => {
  const all = [...thresholds.blockingDimensions, ...thresholds.qualityDimensions].sort();
  assert.deepEqual(all, [...DIMENSIONS].sort(), "thresholds must classify every rubric dimension exactly once");
});
