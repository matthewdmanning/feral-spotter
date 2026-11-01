# Feature-folder migration

**Scope:** refactor + tooling
**Issues/spec:** [2026-11-01-feature-folder-migration.md](../planning/2026-11-01-feature-folder-migration.md)
**Date:** 2026-11-01
**Branch/PR:** `ccr-d1ea87aa-foxilz`

## Scope

**In scope:**

- [x] Move `src/{screens,components,hooks,lib}` into `src/features/`, `src/core/`, `src/shared/`.
- [x] Move `src/{config,content,types,utils}` under `src/shared/`.
- [x] Remove the `src/hooks/index.ts` barrel.
- [x] Fix the six back edges (plan §4, E1–E6).
- [x] Lint-enforce the level rule and ban import cycles.
- [x] Update live docs, ADR paths and code-comment paths.

**Out of scope / not addressed:**

- Behavior changes of any kind.
- Historical docs (`docs/implementations/`, `planning/`, `test-drives/`) keep old paths.
- `scripts/format-shared.mjs` still lists 3 files deleted before this branch.

## Intent

**Purpose:** group code by feature so a change to one feature stays inside its
folder, and make the dependency direction checkable.

## Design decisions and reasoning

Recorded in plan §8 (D1–D5) and [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md).
Key points:

- **Screens are the composition layer.** Only non-screen code obeys the level
  table. Reason: the create screen needs library-picker and annotate, which
  depend on the draft; without the exemption that is a cycle.
- **No barrels.** Reason: Metro bundles every re-export (#406); barrels invite
  init-order cycles.
- **Consent state is shared** (`shared/consent/`). Reason: auth screens and
  permissions/communications otherwise import each other.

## What shipped

- Unit layout: auth, permissions (onboarding, consent, photo, location,
  communications), settings, draft-submission, camera-control, library-picker,
  annotate, history; `core/home`, `core/location`; `shared/`.
- `src/core/location/liveFix.ts` — was `src/lib/location.ts`, renamed to avoid
  colliding with its tuning file `location.ts`.
- `src/features/draft-submission/lib/analytics.ts` — `fireAnalyticsEvent`,
  moved out of `shared/analytics`.
- `sightingPhotoCount` moved from `history.ts` to `submissionCache.ts`.
- `src/features/draft-submission/config/catForm.ts` — was
  `screens/submission/cats/constants.ts`.
- `scripts/move-module.mjs` — `git mv` + rewrite of import, `require`, dynamic
  import and `jest.mock`-family specifiers; verifies resolution before and after.
- `eslint.config.js` — `BOUNDARY_LEVELS`-generated `no-restricted-imports`
  blocks; `import/no-cycle` with the TypeScript resolver.
- Old→new path map: `git diff -M --name-status fab2e54 fa42026`.

## Tests

No new tests; the suite is the regression net. Test files moved with their
subjects. Test edits:

| Test file                                                                                                                   | Change                                                  |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `useLibraryPhotoPicker.{selection,permissionGate.model}.test.ts`, `useCapturedPhotoWorkflow.test.tsx`                       | Deleted identity `jest.mock('@/src/hooks')`             |
| `useCameraCapture.controls.model.test.ts`, `CatObservationScreen.insetCropHeaderZone.test.tsx`                              | Barrel mock → store-module mock spreading `requireActual` |
| `useSubmissionSubmit.{reset,cacheSync}.test.ts`                                                                             | Mock `fireAnalyticsEvent` at its new module             |
| `tabIcons.invariant.test.ts`                                                                                                | `__dirname`-relative route path deepened one level      |

**Not tested:**

- Boundary lint has no committed test; each rule was shown to fire on planted
  violations, then removed.

## Verification status

**Run and passing (every commit):**

- [x] Type checking: `npx tsc --noEmit` (`npm run typecheck` on the last move)
- [x] Unit/model tests: `npx jest` — 100 suites, 477 tests, same as baseline
- [x] Lint: `npx eslint src __tests__` — 0 errors, 6 pre-existing warnings
- [x] Formatting: `npm run format:check`
- [x] Commit messages: `npx commitlint --from fab2e54 --to HEAD`
- [x] Build: `npx expo export --platform android` bundles

**Unverified:**

- No device or emulator launch.
- iOS bundle not exported.

## Graveyard: pivots and corrections

### Relative specifiers turned into aliases

- **Finding:** the move script aliased every relative specifier that climbed
  `../`, even when the relative form was still correct. Prettier then split
  `require(...)` lines, detaching `eslint-disable-next-line` comments
  (6 → 16 warnings).
- **Impact:** noisy diffs; broken lint suppressions.
- **Resolution:** restored 118 specifiers; the script now keeps an unchanged
  relative specifier.

### Specifiers in generic calls

- **Finding:** `jest.requireActual<T>('…')` was invisible to the script's regex.
- **Resolution:** regex accepts type arguments; one missed path fixed by hand.

### `fireAnalyticsEvent` destination

- **Finding:** the plan put it in history, but draft-submission calls it too.
- **Resolution:** placed in draft-submission (lower level).

## Follow-ups and known limitations

- [ ] Boundary lint checks `@/` imports only; a relative import across units
      passes it. None exists today (checked by a one-off graph script).
- [ ] Prune the 3 stale entries in `scripts/format-shared.mjs`.
- `.githooks/*` are not executable in this clone, so local hooks did not run;
  checks were run by hand.
