# Code audit fixes — logic lens

**Scope:** fix
**Issues/spec:** `docs/reviews/2026-11-24-code-audit-logic.md` (LOGIC-1–6, LOGIC-T-1–4), decisions in `docs/reviews/2026-11-24-code-audit-decisions.md`
**Date:** 2026-11-24
**Branch/PR:** `fix/audit-logic`

## Scope

**In scope:** LOGIC-1, LOGIC-2, LOGIC-3, LOGIC-4, LOGIC-5, LOGIC-6; test findings LOGIC-T-1–4. ADR-0003 amended.

**Out of scope:** P3s LOGIC-7–14 (filed as issues).

## What shipped

| Finding | Change                                                                                                                                                                                                                                                                                                                                               |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LOGIC-1 | `resolvePhotoTime` returns `{time_source, time?}`: capture → own EXIF → manual → `unknown`. No submit-moment fallback, no submission-wide `captured_at` borrowing. Submission Details shows "Time unknown" (`submissionCopy.time.unknown`) instead of today's date. `DateTimePickerButton` accepts `value: undefined` + `emptyLabel`.                |
| LOGIC-4 | `metadata.json` gains `photo_times` (`SubmissionApiPayload`, `PhotoTime` type). `finalizeSubmissionPhotoMetadata` no longer writes `photo_time`.                                                                                                                                                                                                     |
| LOGIC-2 | `removePhotoFromDraft` re-derives after removal: empty pool → `resetSourceMetadata()` (device location/time, coords cleared, sharing confirmation invalidated); Library removal → `classifyLibraryPickTime` over the remaining pool.                                                                                                                 |
| LOGIC-3 | `discardUnsurvivingDraft` dates a photo draft by `max(pool updated_at, row updated_at)`. An undated pool is still discarded.                                                                                                                                                                                                                         |
| LOGIC-5 | Server: `releaseGrant`/`releaseSubmittedGrant` end a Submission's grant when its `metadata.json` finalizes (`onSubmissionSubmitted`); the reservation stays counted. Client: `UploadAdmissionError.reason` stored as `SubmissionPhoto.upload_refusal`; Submit shows "Photos Could Not Upload" + reason copy (`submissionCopy.alerts.uploadRefused`). |
| LOGIC-6 | `redactErasedAuthor(uid)`: comments keep body, `authorUid` → `ERASED_AUTHOR_UID`; reactions deleted. Runs after `eraseOrganizationData` blocks writes (`erasure/adapters.ts`). Account deletion only.                                                                                                                                                |

## Tests

- `payload.test.ts` `photo_times` table — each time source, and `unknown` instead of the old "now" fallback (LOGIC-T-1). Replaces the five `resolvePhotoTime` cases.
- `useSubmissionSubmit.submitFlow.test.ts` — finalize failure keeps both photos' times in `metadata.json` (LOGIC-T-4); refusal reason reaches the dialog (LOGIC-5). Two precedence cases deleted: subsumed by the payload table.
- `CreateScreen.timeUnknown.test.tsx` — unset manual time reads "Time unknown".
- `removePhotoFromDraft.test.ts` — empty pool resets, Library removal reclassifies, removing the timeless photo leaves manual (LOGIC-T-2).
- `draft.startup.test.ts` — stale pool + fresh row survives (LOGIC-T-3); the cleanup test now ages both dates.
- `uploadNewPhoto.queue.test.ts` — refusal recorded, cleared on success.
- `functions/.../admission.test.ts` — released slot frees `MAX_GRANTED_SUBMISSIONS` while keeping the reservation; `releaseSubmittedGrant` publishes the claim without the sent Submission.
- `functions/.../pinInteractions.model.test.ts` (emulator) — erased author's comment stays unnamed, stored `authorUid` redacted, reactions gone.
- `functions/src/erasure/__tests__/adapters.test.ts` — redaction runs after write-blocking erasure.

New LOGIC tests were run against the pre-fix code and failed there.

## Verification

- Run: `npm run typecheck`, `npm test` (144 suites), `functions` Jest (10 suites), `npm run test:organizations:emulator` (5 suites), ESLint on changed paths.
- Unverified: no device drive. The Storage trigger's grant release is covered by the ports test, not the Storage emulator trigger.
