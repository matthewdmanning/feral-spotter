---
title: CI action optimization
tags:
  - implementation
  - tooling
---

# CI action optimization

**Scope:** tooling
**Issues/spec:** CI optimization task based on run 43959116394
**Date:** 2026-11-16
**Branch/PR:** ci-optimize-actions

## Scope

**In scope:**

- [x] Cache root `node_modules` exactly in the app and rules jobs.
- [x] Retain npm's package-cache path for cold installs and cache Firebase emulator binaries.
- [x] Limit cancellation to pull-request runs for Commit Lint and CodeQL.

**Out of scope / not addressed:**

- No path filtering, job dispatch, composite action, dependency, or test-command redesign.
- No CodeQL language/configuration change and no changes to the Claude mention workflow.

## Intent

**Purpose:** Reduce repeated root dependency installation and emulator downloads while preserving install scripts, security checks, test commands, full-history formatting behavior, and scheduled/main CI semantics.

## Design decisions and reasoning

### Exact dependency cache keys

- **Decision:** Cache only `node_modules` with an exact key containing runner OS/architecture, resolved `setup-node` version, the OS ID/version from `/etc/os-release`, and hashes of `package.json`, `package-lock.json`, and `.npmrc`.
- **Reason:** A cache hit is valid only for the same runtime, hosted-image family/release, and install inputs. No broad restore key can safely substitute for those inputs.

### Cold and warm install behavior

- **Decision:** Cache misses use `npm ci --prefer-offline`; hits skip reinstall, rerun `npm run prepare`, and run `npm audit` as an informational, continue-on-error check.
- **Reason:** The root prepare script configures Git hooks. The audit remains visible without turning the existing baseline audit findings into a new vulnerability gate.

### Emulator and workflow concurrency caches

- **Decision:** Cache `~/.cache/firebase/emulators` by runner OS/architecture and the root lockfile hash. Commit Lint and CodeQL cancel only superseded pull-request runs.
- **Reason:** Firebase CLI controls emulator binary versions; the lockfile is the dependency input available to this workflow. Main pushes and scheduled CodeQL runs retain their default non-canceling behavior.

## What shipped

- `.github/workflows/ci.yml`: exact root dependency caches in `lint-and-test` and `rules-test`, runner image capture, cold-install preference, cache-hit prepare/audit behavior, complete rules npm cache dependencies, and Firebase emulator caching.
- `.github/workflows/commitlint.yml` and `.github/workflows/codeql.yml`: PR-only cancellation concurrency.

## Tests

**Model or flow covered:** Declarative workflow configuration; no new application logic.

**Not tested:**

- No new workflow test file or full application/runtime suite was needed.

## Verification status

**Measured baseline:** PR CI run [43959116394](https://github.com/matthewdmanning/feral-spotter/actions/runs/43959116394) recorded root `npm ci` at 116 seconds despite an npm-cache hit, tests at 49 seconds, and checkout at 13 seconds. The rules job recorded root `npm ci` at 111 seconds, Functions `npm ci` at 4 seconds, and a fresh Firebase emulator download.

**Run and passing:**

- [x] Actionlint 1.7.12: workflow syntax, action inputs, and expressions passed. ShellCheck was unavailable on the Windows host.
- [x] Prettier and YAML parser checks passed.
- [x] Parsed comparison with `origin/main`: triggers, permissions, job IDs, existing check commands, their failure handling, and full-history checkout are preserved. Exact dependency keys have no fallback restore keys.

Repeat the workflow validation with [actionlint](https://github.com/rhysd/actionlint/blob/main/docs/install.md):

```sh
actionlint -shellcheck= .github/workflows/ci.yml .github/workflows/commitlint.yml
```

**Unverified:**

- Warm-cache runtime gain is not measured. The module-cache archive may be large; publish and run CI warm-cache validation before claiming a speedup.
- The hosted runner remains `ubuntu-latest`; the cache key records its OS ID/version to prevent cross-release reuse.
- Local formatting/parsing/actionlint checks cannot prove a hosted cache hit or the actual runner image; an actual published workflow run is required for that validation.

## Follow-ups and known limitations

- [ ] Run a post-publication warm-cache CI comparison and report observed archive size and timings.
- `actions/setup-node`'s npm cache remains a package-tarball cache; it does not replace the exact `node_modules` archive.

## 2026-11-20 — fix

**Purpose:** Remove the Swift CodeQL build requested after PR #482's failing autobuild.

**Change:** Delete `.github/workflows/codeql.yml`, whose only analysis language was Swift, rather than retain an empty language matrix. The failed run also reported that GitHub's default CodeQL setup was enabled and rejected this advanced workflow's upload; no repository security settings are changed.

**Verification:** Review confirms the removed workflow contained only Swift. Formatting and whitespace checks cover this change; application tests do not exercise workflow removal. Hosted CI must confirm the updated PR checks.

## 2026-11-23 — fix: CodeQL advanced workflow

**Purpose:** Code scanning stopped. The last default-setup run was 2026-11-22 09:05 UTC (PR #490); main's push `101b6ea` and PRs #496–#498 got none, while CI ran.
**Change:** `.github/workflows/codeql.yml` scans `javascript-typescript` and `actions` on pushes and PRs to main and weekly, with no build. It replaces the default setup (#482), which must be switched off: an advanced workflow cannot upload while the default setup is on. Swift and Kotlin stay unscanned, as after #482.

**Verification:** Not run. The workflow's first run, on this PR, is the check. The cause of the stop is unconfirmed: the setting is not readable from the session.
