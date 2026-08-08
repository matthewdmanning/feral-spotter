# 2026-07-28 — Firebase Auth: environment restored, live verify still pending

Continues `2026-07-27-firebase-auth-migration-handoff.md`. Read that first for the migration decision and full scope; this doc covers only what changed this session and what remains.

## What happened this session

- **Decision: go with `issue-7-firebase-auth-migration`.** Confirmed the branch chain is `main` → `issue-67-consent-blocked-gate-recheck` → `issue-7-firebase-auth-migration`. `merge-base(issue-7, issue-67)` equals issue-67's exact tip, so **issue-7 fully contains issue-67** (the #63/#93/#67/#66 consent fixes). issue-7 is **14 commits ahead of `origin/main`, 0 behind** — a clean fast-forward, no rebase needed. Merging issue-7 alone brings the consent fixes along; the old handoff's "merge 67 first" ordering is moot.

- **Restored a broken baseline.** The handoff claimed typecheck/lint/tests all green; they were red on checkout. Root cause was stale environment, **not** a code regression: `@react-native-firebase/app` + `/auth` were declared in `package.json` and present in the lockfile but missing from `node_modules`.
  - `npm ci --legacy-peer-deps` (chosen to protect the lockfile) **backfired on Windows**: `npm ci` wipes `node_modules` before installing and aborted mid-delete on an `EPERM` file lock (`re2.node`, held by a pre-session process), gutting the tree (jest was deleted).
  - Recovered non-destructively with `npm install --legacy-peer-deps`, which does not pre-wipe. **`package-lock.json` is byte-identical to before** (verified against a backup). No package versions changed — the install only resynced `node_modules` to the existing lockfile.
  - The lingering `import/no-unresolved` lint error on `@react-native-firebase/auth` was a **stale `.expo/cache/eslint` phantom** (single-file `npx eslint` was clean, full `expo lint` was not). Cleared with `expo lint --no-cache`.
  - **Baseline now green:** typecheck clean, `npm run lint` 0 errors (5 pre-existing `require()` warnings in test files, out of scope), tests 51/51.

- **google-services.json is present** at repo root (gitignored, never committed — confirmed not in git history on any branch, not in other worktrees). **Handoff step 1 is done** for a local build on this machine.

## Firebase integration status — config-complete, ZERO runtime proof

| Layer                                                                       | State                             |
| --------------------------------------------------------------------------- | --------------------------------- |
| JS packages installed                                                       | done                              |
| Code wired — `createFirebaseAuthProvider()` used in `src/lib/auth/index.ts` | done                              |
| `app.json`: `@react-native-firebase/app` plugin + `googleServicesFile`      | done                              |
| Native `android/` gradle (google-services plugin)                           | generated at prebuild — see below |
| Built with Firebase                                                         | **never**                         |
| Run live on a device                                                        | **never**                         |

`android/` is **gitignored (managed / Continuous Native Generation)** — not a committed bare project. The local `android/` is stale (predates Firebase, `grep firebase android/app/build.gradle` = 0 hits), but that is irrelevant: `expo prebuild` / EAS regenerates it and the `@react-native-firebase/app` config plugin injects the `com.google.gms.google-services` gradle wiring at build time. So the native layer auto-wires on a clean build — it has just never been built.

## Do this next, in order

1. **Live device verification (the real remaining work).** Everything so far is typecheck/lint/unit-test green only.
   - Kill the 6 stale `node` processes from ~12:33 PM (pre-session) — one is plausibly a **Metro server on the old branch** and it holds the `re2.node` lock. Restart Metro on `issue-7-firebase-auth-migration`.
   - `npx expo prebuild --clean` to regenerate `android/` with Firebase wired.
   - Build + run on a device/emulator. Walk the full chain: intro-flow → sign-in (real Google account) → analytics-consent → consent → home. Confirm #66 (camera-consent-treated-as-denial) is actually fixed by the sequential-permission change — same root cause as #67, never independently confirmed.
2. **Open the PR for issue-7 → `main`** once verified. Single PR; it carries issue-67's fixes. Include `Closes #7` (+ the consent issues it resolves) in body and merge commit. Do not merge without Matthew's explicit go-ahead.
3. **Then the older backlog from the 07-27 handoff:** Firebase Storage Security Rules (Cloud Run/GCS plan scrapped); resolve PostHog / Task 5 (merge+verify `issue-13-posthog-analytics`, or swap to Firebase Analytics + Crashlytics).

## Open decision — peer-dep flag does not persist (blocks handoff steps 1 & 3)

The install was unblocked by passing `--legacy-peer-deps` **manually**. Nothing records it. The conflict is Firebase-independent (`@react-native/jest-preset@0.86` from jest-expo@57 vs `react-native@0.85.3`'s peerOptional `0.85.3`) — it would fail on `main` too. Consequences:

- CI running `npm ci` on the PR → identical `ERESOLVE` failure.
- A fresh clone / the EAS build machine → same wall.

Fix is either committing `.npmrc` with `legacy-peer-deps=true`, or an `overrides` pin on `@react-native/jest-preset`. **Not done** — it is project-wide config, out of issue-7's scope, and overlaps the recurring peer-dep saga that already has dedicated branches (`issue-54-peer-dep-conflict` stash is literally jest/package.json/lock; `issue-17-peer-dep-conflict` worktree at `C:/wt/i17`). **Matthew to decide:** commit `.npmrc` on issue-7 now, or fold into the issue-54 work.

Note: `--legacy-peer-deps` is an npm **resolver** flag, not the library legacy/compat shim `CLAUDE.md` warns about — different thing.

## Don't

- Don't `npm audit fix --force` (Matthew, explicit).
- Don't touch `PROJECT_STATUS.md` directly — see the `report-status-findings` skill.
- Don't merge to `main` without Matthew's explicit go-ahead.
- Don't commit `google-services.json` / `firebase.json` / `.firebaserc` — the project ID must not land in this public repo. (They are gitignored on this branch; they are **not** gitignored on `main` / `issue-47`, where they show as untracked — do not `git add` them there.)
