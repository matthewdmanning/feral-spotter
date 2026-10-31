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
- [x] Finish (restored) and Reset (in-session, with confirmation) buttons.

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
- **Known edge:** A pool saved before `updated_at` existed has `null`. It counts as restored and is never expired by the start-up check. The next photo change stamps it.

### No photo, no survival

- **Decision:** At start-up, a draft with no photo is discarded in full, including its cache row.
- **Reason:** The issue says a draft survives only if a picture was taken or selected.

## What shipped

- `src/config/constants.ts`: `SUBMISSION_STALE_MS` is 48 hours. New `APP_STARTED_AT`.
- `src/hooks/usePhotoStore.ts`: `updated_at`.
- `src/lib/submission/draft.ts`: `discardUnsurvivingDraft(now)`. It waits for all four draft stores to hydrate, then discards through `discardDraft`.
- `src/app/_layout.tsx`: runs the check once at start-up.
- `src/components/molecules/PhotoDraftNotice.tsx` and `.styles.ts`: copy, Finish or Reset button, and 24 dp bottom padding.
- `src/screens/home/index.tsx`: uses the notice. Finish opens `/submission/create`. Reset calls `confirmResetSubmission`.

## Tests

**Model or flow covered:** the start-up survival rule, and Home's notice for each draft origin.

| Test file                                                                | What it verifies                                                                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `src/lib/submission/__tests__/draft.startup.test.ts`                     | Real stores: kept inside the window, discarded past it, discarded with no photo, kept when `updated_at` is null |
| `src/screens/home/__tests__/HomeScreen.draftNotice.test.tsx`             | Empty pool shows nothing. Restored shows Finish and opens the report. In-session shows Reset and asks first     |
| `src/screens/home/__tests__/HomeScreen.entrypointActions.model.test.tsx` | The stale draft case now reads `SUBMISSION_STALE_MS`, not a literal 25 hours                                    |

**Not tested:**

- `_layout.tsx` calling the check. The function is tested. The call is one line.

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
- Legacy pool with `updated_at` of `null` is never expired by the start-up check.
