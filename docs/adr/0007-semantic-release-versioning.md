# 0007. Conventional Commits drive semantic-release from `main`

- **Status:** Accepted
- **Date:** 2026-08-30
- **Approver:** Prince Agyei Tuffour (@nanaagyei)
- **Implemented by:** [#110](https://github.com/akomapahealth/akomapa-lms/issues/110)

## Context

Release tooling is already in place. `.releaserc.json` runs semantic-release
from `main` only, using the `conventionalcommits` preset, tagging as
`v${version}`, with `feat` producing a minor release and `fix`, `perf`, and
`revert` producing a patch. `commitlint.config.cjs` and a Husky hook enforce
the commit format locally, and the CI `commitlint` job re-checks the incoming
range on every pull request.

What is not written down is what the version *means*. `package.json` still
reads `0.1.0` while releases are tagged independently, so a running deployment
cannot state its own version. `dev` is the integration branch and `main` is the
release branch, but nothing records how a change reaches a release, or what
happens to a breaking change. The release-gate work in
[#110](https://github.com/akomapahealth/akomapa-lms/issues/110) to
[#113](https://github.com/akomapahealth/akomapa-lms/issues/113) needs a fixed
answer to build on.

## Decision

**The commit history is the release input. semantic-release is the only thing
that decides a version number.**

1. **Conventional Commits are mandatory.** Every commit that reaches `main`
   follows the format enforced by `commitlint.config.cjs`. The CI job is
   blocking, not advisory.
2. **The type determines the bump.** `feat` is minor, `fix`, `perf`, and
   `revert` are patch, and a `BREAKING CHANGE:` footer or a `!` after the type
   is major. Types with no release rule, including `docs`, `chore`, `ci`,
   `test`, `refactor`, and `style`, produce no release. A change that alters
   product behaviour is never filed under one of those types to avoid a bump.
3. **`main` is the only release branch.** `dev` is the integration branch;
   nothing is tagged from it, and no other branch produces a release.
4. **No human sets a version.** Version numbers are never edited by hand, in
   `package.json` or anywhere else. A pull request that changes a version
   number is rejected.
5. **A build knows its own version.** The released version and commit are
   injected at build time and exposed on the health endpoint
   ([#112](https://github.com/akomapahealth/akomapa-lms/issues/112)), so a
   running deployment can be identified without guessing from a tag.
6. **Pre-1.0 semantics end at the milestone.** Until `v1.0.0`, a breaking change
   is a minor. From `v1.0.0`, major means a breaking change to a public surface:
   a route, an API response shape, a webhook contract, or a Certificate
   verification format.
7. **Releases serialise.** Two releases never run concurrently
   ([#111](https://github.com/akomapahealth/akomapa-lms/issues/111)); a second
   run waits or fails rather than racing the first for a tag.

## Consequences

- Commit messages are a release artefact. A vague or mistyped commit message
  produces a wrong version, so message review is part of code review.
- Squash-merging to `main` means the squashed message is the one that counts,
  and it must carry the correct type and any breaking-change footer. The
  individual commits on the branch do not.
- `CHANGELOG.md` is generated, and is gitignored in this repository. It is not
  hand-edited.
- Rolling back a release means shipping a `revert` commit, which produces a new
  patch version. Tags are never deleted or moved.
- Release credentials are scoped to the release workflow. Nothing else can tag.

## Alternatives considered

**Manual versioning in `package.json`.** Rejected: it drifts from the tags,
depends on someone remembering, and gives no reliable input to release gates.

**Calendar versioning.** Rejected: it conveys nothing about compatibility,
which is the one thing a version must communicate once `/verify` and the
webhook contracts are public.

**Release from `dev`.** Rejected: `dev` is where integration failures surface.
Tagging from it would publish states that were never intended to ship.

**Drop Conventional Commits and pick versions in a release meeting.**
Rejected: it makes releases a human bottleneck and removes the automated
classification that #110 to #113 build their gates on.

## Links

- `.releaserc.json`, `commitlint.config.cjs`, `.github/workflows/release.yml`, `.github/workflows/ci.yml`
- Issues [#110](https://github.com/akomapahealth/akomapa-lms/issues/110), [#111](https://github.com/akomapahealth/akomapa-lms/issues/111), [#112](https://github.com/akomapahealth/akomapa-lms/issues/112), [#113](https://github.com/akomapahealth/akomapa-lms/issues/113)
