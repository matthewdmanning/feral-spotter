---
title: Continue Observation button on Home
aliases:
  - Feature implementation note
tags:
  - implementation
---

# Create a Continue Observation button on Home

**Scope:** feature
**Issues/spec:** #256 (closes)
**Date:** 2026-08-15
**Branch/PR:** issue-256-continue-observation / feral-spotter PR #274

## Scope

**In scope:**

- [x] "Continue Observation" button on Home, replacing "Resume Submission"
- [x] Only shown for an in-progress draft that is **not stale** — staleness
      threshold configurable, not hardcoded
- [x] Routes to the Cat List screen (`src/screens/submission/create/index.tsx`)

**Out of scope / not addressed:**

- Circular entrypoint-button redesign (camera/library icons) — separate
  design brief, documented as an extension in
  [2026-08-09-home-large-icon-buttons.md](2026-08-09-home-large-icon-buttons.md),
  shipped in the same PR since both touch `src/screens/home/index.tsx`.

## Intent

**Purpose:** #256 replaces #157's "Resume Submission" button. #157's own
investigation found the button worked and was on-screen, but ranked low in
visual priority (3rd of 4 buttons, below both fresh-capture entry points) —
that was a `ready-for-human` design question, not implementation-ready. #256
is the fully-specified fix Matthew scoped separately: rather than
reposition/restyle the existing button, replace it with a differently-scoped
one — gated on staleness, routed straight to Cat List instead of Submission
Details.

## Design decisions and reasoning

### Route: no change needed

- **Decision:** `handleContinue` still calls
  `router.push('/submission/create')` — identical to the old `handleResume`.
- **Reason:** `create/index.tsx`'s own header comment confirms it's already
  the Cats List + Submission Details landing view (#97's split) — the
  issue's routing ask was already satisfied by existing code, not a change.
- **Affected journey/state:** Home's `continue`-keyed button press.

### Staleness threshold: configurable constant, default 24h

- **Decision:** `SUBMISSION_STALE_MS` (`src/config/constants.ts`), compared
  against the latest cache's `updated_at`.
- **Reason:** #256 says "configurable (not hardcoded)" but doesn't specify a
  value — 24h is a chosen default, not derived from the spec. Flagged to the
  user as such rather than presented as spec-derived.
- **Affected journey/state:** Home's mount effect that decides
  `columnVisible`.

## What shipped

- `src/config/constants.ts`: `SUBMISSION_STALE_MS = 24h`.
- `src/screens/home/index.tsx`: button renamed `resume`→`continue` /
  "Resume Submission"→"Continue Observation"; mount effect now also checks
  `Date.now() - new Date(latest.updated_at).getTime() > SUBMISSION_STALE_MS`
  before setting `columnVisible`.
- `docs/qa_checklist.md` B3 line updated to match (docs submodule).

## Tests

**Model or flow covered:** `HomeScreen`'s mount-time Resume/New column
visibility gate (`HomeScreen.entrypointActions.model.test.tsx`).

| Test file | What it verifies |
| --- | --- |
| `src/screens/home/__tests__/HomeScreen.entrypointActions.model.test.tsx` | New `MOUNT_STALE` journey: a >24h-old in-progress cache keeps the column hidden; renamed-button press (`key === 'continue'`) still routes to `/submission/create` |

**Not tested:**

- No new test for the 24h boundary itself (exactly-at-threshold) — the
  formula is a single inequality, not flagged as needing dedicated coverage
  beyond the stale/fresh cases already modeled.

## Verification status

**Run and passing:**

- [x] Type checking: `npx tsc --noEmit`
- [x] Unit/model tests: `npx jest src/screens/home` (all 3 HomeScreen suites)
- [x] Lint: `npx eslint` on touched files
- [x] Formatting: `npx prettier --write` on touched files

**Unverified:**

- Not run on a physical device/emulator.

## Graveyard: pivots and corrections

### Weak test assertion, caught by advisor

- **Finding:** `HomeScreen.entrypointActions.model.test.tsx`'s `idleEntry`
  state asserted `capturedVisible === false` — identical to the test file's
  own untouched default (`capturedVisible = false` in `beforeEach`), so the
  assertion passed whether the staleness logic worked or the mount effect
  never resolved at all.
- **Impact:** The new stale-draft test would have been a false positive —
  passing regardless of whether the staleness gate actually worked.
- **Resolution:** Changed the default to `null` (not `false`) so the
  assertion is a real discriminator. Verified by temporarily flipping the
  staleness comparison operator (`>` → `<`) and confirming the suite then
  failed (4 failures), then reverting.

## Follow-ups and known limitations

- Device/emulator verification of the staleness gate not done this session.

## 2026-08-25 — fix

**Purpose:** Clear Draft deleted the cache row and returned Home, but Home
still offered Continue Observation, and tapping it dead-ended on annotate's
"No photos to review." (#314)

**Change:** `src/screens/home/index.tsx` re-reads
`getAllSubmissionCaches()` on every focus rather than once on mount, gated on
`useIsFocused()`.

**Load-bearing landmines:**

- **`discardDraft()` was never the defect.** Force-stopping and relaunching
  made the phantom entry disappear, so the row had in fact been deleted. The
  fault was Home's view of the result, not the teardown seam. Anyone reopening
  this should not go looking at `lib/submission/draft.ts`.
- **Home and Settings are sibling tabs** (`src/app/(home-tabs)/`), so moving
  between them is a tab switch, not a mount. A mount-once effect never re-runs.
  Reset only escaped the bug because its navigation path unmounts Home.
- **The bug ran both ways.** A draft started and returned from also left the
  entry *hidden*. Both directions are device-verified.
- **The cleanup's `cancelled` flag is not decoration.** Two focus cycles can
  resolve out of order and let the older read win. Removing it reintroduces a
  race that the mount-once version could not exhibit.
- `HomeScreen.resumeEntry.test.tsx`'s third case (`does not re-read while
  blurred`) passes against the pre-fix code too — it guards blur cancellation,
  not the staleness. Do not read it as regression cover for #314.

**Verification:** full gates pass. Device-verified on a Pixel 7 — the issue's
own repro (draft → Settings → Clear Draft → confirm) now leaves Home with only
Take Photos / Upload Photos, from an already-mounted Home.
