---
title: Photo draft expiry, start-up check and Home notice
tags:
  - implementation
---

# Photo draft expiry, start-up check and Home notice

**Scope:** feature
**Issues/spec:** #424
**Date:** 2026-10-31
**Branch/PR:** `issue-424-photo-draft-expiry`

## Scope

**In scope:**

- [x] A draft survives an app restart for 48 hours at most, and only with a photo.
- [x] The survival rule runs at app start-up.
- [x] Home shows different copy for a restored draft and an in-session draft.
- [x] More space between the Home notice and the bottom tabs.
- [x] Reset (always, with confirmation) and Finish (restored draft only) buttons. The dialog says camera-roll copies stay when "Keep Photos on Device" saved some.

**Out of scope / not addressed:**

- Continue Observation and New Sighting are unchanged. A draft with a cache row shows them beside the new notice.

## Intent

**Purpose:** A fresh install that kept app data showed a 3-day-old photo draft. It locked Upload Photos, with no way to finish or reset it from Home.

## Design decisions and reasoning

### One timing rule: `SUBMISSION_STALE_MS`, now 48 hours

- **Decision:** `SUBMISSION_STALE_MS` is 48 hours and gates both Continue Observation and the start-up check.
- **Reason:** The photo store never expired, while Continue Observation did after 24 hours. The two disagreed, so a stale pool locked an entrypoint with no Continue button. One constant keeps them equal. The issue asked for 48 hours.
- **Related decision:** `docs/DESIGN.md` row H3 says the 24-hour gate stays the only timing rule. It stays the only rule. Its value changed.

### Age is the last pool change

- **Decision:** `usePhotoStore.updated_at` is set when a photo is added, and when one is removed while others remain. It is `null` for an empty pool.
- **Reason:** A photo draft has no cache row until Submission Details opens, so the cache row's `updated_at` cannot age it. Progress updates do not bump it, so an upload does not extend a draft.

### Restored means "changed before this process started"

- **Decision:** Home treats a pool whose `updated_at` is before `APP_STARTED_AT` as restored. Adding a photo in-session makes it in-session.
- **Reason:** No flag to keep in sync or reset on teardown.
- **Legacy migration:** A pool saved before `updated_at` existed uses the current cache row's `updated_at`, persisted back to the photo store without extending its age. A stale pool, or one without a usable age, is discarded.

### No photo, no survival

- **Decision:** At start-up, a draft with no photo is discarded in full, including its cache row.
- **Reason:** The issue says a draft survives only if a picture was taken or selected.

## What shipped

- `src/config/constants.ts`: `SUBMISSION_STALE_MS` is 48 hours. New `APP_STARTED_AT`.
- `src/hooks/usePhotoStore.ts`: `updated_at`.
- `src/lib/submission/draft.ts`: hydrates all four stores, clears expired state and detaches the old cache pointer, then enables capture before cleaning old history/uploads. Photo-file deletion uses idle callbacks.
- `src/app/_layout.tsx`: starts restoration in the background. Routes and the splash wait only for the existing font load, so Home and the Camera preview do not wait for draft cleanup.
- `src/hooks/useDraftStartupStore.ts`: shares one process-local initialization task. Capture becomes safe after restoration; submission routes, resume-cache reads, Library picks and Reset wait for full cleanup.
- The four draft stores defer hydration to that shared task, avoiding import-time I/O and duplicate reads.
- `src/components/molecules/PhotoDraftNotice.tsx` and `.styles.ts`: copy, Reset button (and Finish when restored), and 24 dp bottom padding.
- `src/screens/home/index.tsx`: uses the notice. Finish opens `/submission/create`. Reset calls `confirmResetSubmission`. A disabled entrypoint circle is greyed out, reticle included.
- `src/hooks/confirmResetSubmission.ts`: the one reset dialog and `discardDraftAndGoHome()`. `useSubmissionSubmit` reuses both.

## Tests

**Model or flow covered:** the start-up survival rule, and Home's notice for each draft origin.

| Test file                                                                | What it verifies                                                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/submission/__tests__/draft.startup.test.ts`                     | Real stores: kept inside the window, discarded past it or with no photo, legacy age migrated or discarded, hydration failure rejected |
| `__tests__/RootLayout.startup.test.tsx`                                  | Routes and splash proceed during restoration; capture/full-draft phases are distinct; submission routes wait; failures are logged     |
| `src/screens/home/__tests__/HomeScreen.draftNotice.test.tsx`             | Empty pool shows nothing. Restored shows Finish and opens the report. In-session shows Reset and asks first                           |
| `src/screens/home/__tests__/HomeScreen.entrypointActions.model.test.tsx` | The stale draft case now reads `SUBMISSION_STALE_MS`, not a literal 25 hours                                                          |

## Verification status

**Run and passing:**

- [x] Type checking: `npm run typecheck`
- [x] Unit/model tests: `npm test`
- [x] Lint: `npm run lint`
- [x] Formatting: `npm run format:check`

**Unverified:**

- Device pass: restart with a draft older than 48 hours, restart with a fresh draft, and the notice spacing above the tabs.

## Follow-ups and known limitations

- Continue Observation and the Finish button both open the report for a draft that has a cache row.

## 2026-10-31 — fix

**Purpose:** Close the review gaps in legacy expiry and the ordering of start-up cleanup against Home's resume-cache read.
**Change:** Migrate a legacy pool's age from its current cache row, discard it when no usable age exists, and mount routes only after cleanup settles. Hydration failure rejects the check rather than waiting forever. Keep the notice's copy helper and origin type module-local.

**Verification:** Full Jest suite passed (96 suites, 440 tests; `--runInBand --watch=false --watchman=false`), including the new startup-gate and legacy-migration regressions. Typecheck, ESLint on changed code/tests, Prettier on changed files, and `git diff --check` passed. Device restart behavior remains unverified.

## 2026-10-31 — performance

**Purpose:** Keep field camera access off the draft-cleanup critical path while preventing restoration from overwriting a new capture.
**Change:** Replace the global route/splash gate with shared restoration phases. Both camera previews can mount immediately; the shutter and Live fix start once draft state is safe. Expired-draft cleanup snapshots old upload IDs and file URIs, clears state and detaches the old cache pointer, then enables capture before deleting the old history row. Old photo-file deletion is scheduled for idle time. Camera Done, submission routes, resume reads, Library picks and Reset wait for full cleanup; Library picks recheck the source after the system picker returns. Storage failures protect the draft and explain recovery on the camera screen.

**Unverified:** Physical-device cold-start time to preview and first usable shutter. No latency numbers are claimed from JavaScript tests.

**Verification:** Full Jest suite passed: 97 suites, 449 tests. The cold-start regression verifies no import-time photo read, exactly one startup read and restored photos before capture readiness. Workflow checks verify active preview during restoration and safe capture during cleanup. Typecheck, changed-file ESLint (0 errors; one existing test import warning), Prettier and `git diff --check` passed. Independent integration review found no remaining startup race or duplicate production hydration.
