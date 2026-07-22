/**
 * Conventional Commits configuration.
 *
 * Commit types drive automated semantic-release versioning on `main`:
 *   - feat      -> MINOR (feature release)
 *   - fix, perf -> PATCH (bug fix)
 *   - feat! / "BREAKING CHANGE:" footer -> MAJOR
 * Other types (docs, chore, ci, refactor, test, build, style, revert) do not
 * trigger a release by themselves.
 *
 * Example: `feat(courses): add certificate download`
 */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "perf",
        "refactor",
        "docs",
        "chore",
        "ci",
        "test",
        "build",
        "style",
        "revert",
      ],
    ],
    "subject-case": [
      2,
      "never",
      ["sentence-case", "start-case", "pascal-case", "upper-case"],
    ],
    "body-max-line-length": [0, "always", Infinity],
  },
};
