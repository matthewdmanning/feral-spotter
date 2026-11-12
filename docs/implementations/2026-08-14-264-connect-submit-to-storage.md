---
title: Connect submit to backend — Firebase Storage, per-photo ML metadata, uid obfuscation
aliases:
  - Feature implementation note
tags:
  - implementation
---

# Connect submit to backend: final submission upload, self-describing photos, obfuscated uid path

**Scope:** feature
**Issues/spec:** #264 (closes), amends [ADR-0002](../adr/0002-location-services-model.md), [ADR-0003](../adr/0003-time-capture-model.md), [ADR-0005](../adr/0005-firebase-storage-for-uploads.md)
**Date:** 2026-08-14
**Branch/PR:** matthewdmanning/issue264

## Scope

**In scope:**

- [x] Final submission (cats, box geometry per cat, photo paths/locations) uploaded to Cloud Storage as `metadata.json`, replacing the dead `submitObservation()` Cloud Run stub
- [x] Per-photo Storage object made self-describing: `photo_time`, `upload_time`, `location_lat`/`location_lng`, `user_id_hash` backfilled onto each photo's own `customMetadata` at Submit
- [x] Object path owner segment obfuscated — `sha256(salt + uid)`, computed client-side and independently re-verified by `storage.rules`/`firestore.rules`
- [x] Box geometry (`useBoundingBoxStore.getBoxesForCat`) attached per box with its own `cloud_storage_path`
- [x] Per-photo capture time preference over the submission-wide earliest-across-a-multi-select-pick value

**Out of scope / not addressed:**

- #267 (tester allowlist enforcement), #268 (photo-counter cross-tenant collision), #269 (create-vs-overwrite distinction), #270 (per-uid submission cap) — all still open; `__tests__/rules/storage.test.ts` carries regression-marker tests proving #267/#268 are still broken, not fixed by this change.
- #265 (payload validation before submit) — `handleDone` still doesn't validate; the warning icon stays informational, not a submit gate.
- Emulator-based execution of `__tests__/rules/storage.test.ts` — blocked locally (JDK 17 vs firebase-tools' JDK 21 requirement); only validated via `firebase_validate_security_rules` (syntax-only) plus a Node-`crypto` cross-check of the hashing logic itself.

## Intent

**Purpose:** #264 asked to wire submit to a real backend instead of a stub. Mid-implementation, the intended ML/AI use of the uploaded images added a harder requirement: each photo gets exported/consumed separately from `metadata.json` downstream, so it can't assume a fetch back to the submission record — each object needs its own location/time/upload-time/user-id without that lookup. That pushed the final-submission upload target to Cloud Storage (matching the existing photo-upload convention) rather than a database write, and added a per-photo `customMetadata` finalize step. A follow-up request then closed the resulting gap where the per-photo `user_id_hash` was salted but the raw uid was still directly readable from the object's own path.

## Design decisions and reasoning

### Final submission target: Cloud Storage `metadata.json`, not Firestore

- **Decision:** The final submission uploads as `metadata.json` in the same `submissions/{uidHash}/{submissionId}/` folder as the photos, via `uploadSubmissionMetadata()`.
- **Reason:** Images live in Storage; a Firestore write would split the submission across two backends for no benefit and wouldn't match the "self-contained folder per submission" shape `ADR-0005` already established for photos.
- **Affected journey/state:** `useSubmissionSubmit.handleDone`'s submit path.

### Per-photo ML metadata via Storage `customMetadata`, not a Firestore document

- **Decision:** `finalizeSubmissionPhotoMetadata()` patches each already-uploaded photo's own Storage object `customMetadata` at Submit — not a Firestore collection keyed by photo.
- **Reason:** Storage's native `customMetadata` mechanism travels with the object itself; a Firestore-based design was tried first and rejected because it would require a downstream consumer to cross-reference two systems instead of reading one self-contained object.
- **Affected journey/state:** Runs after all photos are already uploaded and the submission's location/time are settled — best-effort, not blocking.

### uid obfuscation: client-side hash + rules-native re-verification, not a Cloud Function

- **Decision:** `hashUid()` computes `sha256(USER_ID_HASH_SALT + uid)` client-side (`expo-crypto`, HEX encoding pinned explicitly); `storage.rules`/`firestore.rules` independently recompute the same value via the rules language's own `hashing.sha256().toHexString()`.
- **Reason:** The literal initial ask was a Cloud Function that assembles the path server-side. `firebase_validate_security_rules` confirmed the rules-native hash compiles in both Storage and Firestore rules, which closes the same gap without a new native dependency (`@react-native-firebase/functions` isn't installed) and without routing uploads through a function — which would have killed the resumable direct-to-Storage upload `ADR-0005` chose specifically over the old `upload+api.ts` route. Confirmed with the user (AskUserQuestion) before implementing.
- **Affected journey/state:** Every photo/metadata Storage write and the Firestore `photoCount`/`ownerUidHash` read.

### Best-effort per-photo finalize, not a submit blocker

- **Decision:** `Promise.allSettled()` over the per-photo `finalizeSubmissionPhotoMetadata()` calls; a rejected patch is logged, not thrown.
- **Reason:** The P0 this app guards hard against is a silently missing photo, not a metadata patch failing on an already-fully-uploaded photo over a flaky connection — don't fail an otherwise-successful submission over that.
- **Affected journey/state:** `handleDone`'s try block, after the upload-completeness guard.

### Per-photo capture time, not the submission-wide value

- **Decision:** `SubmissionPhoto.captured_at` (set at shutter press for Camera captures) is preferred over parsed EXIF, which is preferred over `submission.captured_at`/`manual_time`, which is preferred over Submit-time fallback.
- **Reason:** `submission.captured_at` is the _earliest_ EXIF time across a multi-select Library pick (`ADR-0003`'s interim rule) — correct as a submission-level approximation, but stamped onto every photo it would misdate every photo except the earliest one.
- **Affected journey/state:** `useCameraCapture.tsx` (sets `captured_at`), `useSubmissionSubmit.ts`'s `photoTimeFor()`.

## What shipped

- `src/lib/upload/firebaseUpload.ts`: `hashUid()`, `uploadSubmissionMetadata()`, `finalizeSubmissionPhotoMetadata()`; `uploadSubmissionPhoto()`'s object path now uses `hashUid(uid)`.
- `src/hooks/useSubmissionSubmit.ts`: `handleDone` now calls `uploadSubmissionMetadata`/`finalizeSubmissionPhotoMetadata` instead of the dead `submitObservation`; folds box geometry (with per-box `cloud_storage_path`) into the payload.
- `src/hooks/useBoundingBoxStore.ts`: `getBoxesForCat(catId)`.
- `src/hooks/useCameraCapture.tsx`: sets `SubmissionPhoto.captured_at` at shutter press.
- `src/types/Photo.ts`, `src/types/Api.ts`: `captured_at`; `boxes[].cloud_storage_path`; removed dead `SubmissionApiResponse`.
- `src/config/constants.ts`: `USER_ID_HASH_SALT`, `UPLOADS_MOCK`.
- `src/utils/api.ts`, `__tests__/utils/api.test.ts`: removed `submitObservation`/`getAuthHeaders` (dead Cloud Run leftover).
- `storage.rules`: `{uidHash}` path segment + `isOwner()` rules-native hash check; `metadata.json` as a distinct, non-photo-count-gated write; metadata-only-patch bypass for the finalize step.
- `firestore.rules`, `functions/src/index.ts`: `ownerUid` → `ownerUidHash` (Cloud Function only ever sees the hashed path segment now).
- `__mocks__/@react-native-firebase/storage.js`: added `uploadString`/`getMetadata`/`updateMetadata` mocks.

## Tests

**Model or flow covered:** `useSubmissionSubmit`'s submit path (photo filtering, payload assembly, finalize best-effort); `hashUid`'s salting/determinism; Storage/Firestore rules ownership and write-shape gating; Cloud Function path parsing.

| Test file                                                                     | What it verifies                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/hooks/useSubmissionSubmit.submitFlow.test.ts`                      | Only fully-uploaded photos submit; box geometry with `cloud_storage_path` in payload; salted hash reuse (`hashUid` called, not a separate re-derivable hash); per-photo `captured_at`/EXIF preference over submission-wide earliest; best-effort finalize via `Promise.allSettled` doesn't fail submission on a rejected patch; submit proceeds regardless of consent state |
| `src/hooks/__tests__/useSubmissionSubmit.cacheSync.test.ts`, `.reset.test.ts` | Updated mocks for the new `firebaseUpload` exports; unaffected reset behavior                                                                                                                                                                                                                                                                                               |
| `src/lib/upload/__tests__/firebaseUpload.hashUid.test.ts`                     | `hashUid` salts before hashing (matches a Node-`crypto` reference computation); deterministic; salt actually changes the output vs. unsalted `sha256(uid)`                                                                                                                                                                                                                  |
| `src/hooks/__tests__/useBoundingBoxStore.test.ts`                             | `getBoxesForCat` returns every box across a cat's photos, excludes other cats (string-prefix-match key scheme)                                                                                                                                                                                                                                                              |
| `__tests__/rules/storage.test.ts`                                             | Owner can upload/patch under their own `uidHash` folder; another uid cannot; photo-count cap; `metadata.json` write shape/cap, bypasses the photo-count gate; metadata-only patch bypasses the count gate; #267/#268 regression markers (still failing, by design — document the known gaps)                                                                                |
| `functions/src/__tests__/index.test.ts`                                       | `onSubmissionPhotoUploaded`/`onSubmissionPhotoDeleted` set/decrement `photoCount` and `ownerUidHash`; no-op on malformed paths and on `metadata.json`                                                                                                                                                                                                                       |
| `__tests__/utils/api.test.ts`                                                 | `submitObservation` describe block removed with the dead code                                                                                                                                                                                                                                                                                                               |

**Not tested:**

- Byte-for-byte agreement between `expo-crypto`'s `digestStringAsync` HEX output and the rules language's `hashing.sha256().toHexString()` — both sides are standard SHA-256/hex, but this can't be confirmed without the emulator (see Unverified below).
- Real Cloud Storage/Firestore round-trip (all rules tests are either unrun locally or unit-level with mocked SDKs).

## Verification status

**Run and passing:**

- [x] Type checking: `npx tsc --noEmit` (root) and `npx tsc --noEmit` (`functions/`)
- [x] Unit/model tests: `npx jest` (root — 50 suites, 216 tests) and `npm test` (`functions/` — 7 tests)
- [x] Lint: `npx eslint` on all touched files (0 errors; pre-existing unrelated warnings only)
- [x] Formatting: `npx prettier --check`/`--write` on all touched files
- [x] Rules syntax: `firebase_validate_security_rules` (Storage and Firestore) — confirms `hashing.sha256(...).toHexString()` compiles in both

**Unverified:**

- `__tests__/rules/storage.test.ts` and `firestore.test.ts` against the real Local Emulator Suite — blocked locally (JDK 17 vs firebase-tools' JDK 21 requirement).
- First real-device upload: confirms `expo-crypto`'s hex output actually matches the rules' `hashing.sha256().toHexString()` byte-for-byte. If it doesn't, every upload 403s — this is the single highest-priority thing to check on first device run.
- Production Firestore/Storage state was checked directly (via MCP tools and `gcloud`) and confirmed empty — no existing `/submissions` docs or `submissions/` objects — so the `ownerUid` → `ownerUidHash` field rename and the path-scheme change have nothing to migrate.

## Graveyard: pivots and corrections

### Firestore-based per-photo metadata, abandoned

- **Finding:** First attempt modeled per-photo ML metadata as Firestore documents.
- **Impact:** Wrong backend for images that live in Storage and get exported/flattened independently downstream.
- **Resolution:** Switched to Storage's own `customMetadata` via `getMetadata`/`updateMetadata` — matches the existing photo-upload pattern, no cross-system reference needed.

### Unsalted uid hash

- **Finding:** Initial `sha256(uid)` with no salt was trivially re-derivable by anyone with the Firebase Auth user list.
- **Impact:** No real obfuscation.
- **Resolution:** Added `USER_ID_HASH_SALT`.

### `Promise.all` over per-photo finalize

- **Finding:** One rejected finalize call would throw and fail the entire submission.
- **Impact:** A flaky-network metadata patch on an already-uploaded photo would block an otherwise-successful submit.
- **Resolution:** `Promise.allSettled`, log rejections, don't fail the submission.

### Submission-level photo time applied to every photo

- **Finding:** `submission.captured_at` is the _earliest_ EXIF time across a multi-select Library pick — correct as a submission-level value, but stamped per-photo it misdates every photo but the earliest.
- **Impact:** Every photo except one would carry a wrong `photo_time`.
- **Resolution:** Added `SubmissionPhoto.captured_at` (set at shutter press) and `photoTimeFor()`'s per-photo/EXIF/submission-level preference chain.

### Cloud Function for uid obfuscation, replaced by rules-native hashing

- **Finding:** The literal initial instruction called for a Cloud Function to assemble the obfuscated path. `firebase_validate_security_rules` proved the rules language can recompute the same hash itself.
- **Impact:** A Cloud Function route would have needed a new native dependency and would have routed uploads through the function instead of direct-to-Storage, reversing `ADR-0005`'s resumable-upload rationale.
- **Resolution:** Client-side `hashUid()` + rules-native `hashing.sha256()` re-verification instead — confirmed with the user before implementing.

### Commit-splitting: dead-code removal isn't actually independent

- **Finding:** Attempted to commit `src/utils/api.ts`'s `submitObservation` removal as a standalone first commit. Verifying against a stash showed `useSubmissionSubmit.ts` at that point still called `submitObservation` — the removal and the switch to the new upload flow are one coupled change, not two.
- **Impact:** Would have left a commit that doesn't compile on its own.
- **Resolution:** Reset the commit, folded the dead-code removal into the same commit as the `useSubmissionSubmit.ts` rewrite it depends on.

## Follow-ups and known limitations

- [ ] #267 — tester allowlist enforcement on direct uploads
- [ ] #268 — scope the photo counter per uid, not per submissionId alone
- [ ] #269 — create-vs-overwrite distinction in `storage.rules`
- [ ] #270 — per-uid submission cap
- [ ] #265 — submit payload validation
- Run `__tests__/rules/*.test.ts` against the real Local Emulator Suite once a JDK 21 environment is available, to confirm the rules-side hash verification actually behaves as expected (currently syntax-validated only).
- First real-device submit should be watched for a 403 on upload, which would indicate a hex/encoding mismatch between `expo-crypto` and the rules' `hashing.sha256()`.

## 2026-11-02 — fix

**Purpose:** Codebase review found the submit path could send a Submission with cats but no photos, send twice, wedge, or lose a sent Sighting at startup.
**Change:**

- `useUIStore.isSubmitting` is the in-process submit lock (no longer persisted). Finished!, Reset, Take/Select More Photos and Android Back are inert while it is set; `discardDraftAndGoHome` and `confirmResetSubmission` refuse.
- After the upload wait, Submit re-reads every store and stops if the draft's `submissionId` changed. Cache writes moved inside the try; a failing failure-write no longer skips the error message.
- `uploadNewPhoto`: dedupes by `local_id`; `retryPendingUploads` (Details open + Submit) re-queues `uploaded: false` photos; `cancelQueuedUploads` (draft teardown) drops queued work and detaches in-flight results.
- `submissionCache` mutations run on one write chain; `updateSubmissionCache` takes an in-chain status guard used by draft sync.
- Startup cleanup flips a `Sending` row to `Failed` and never deletes a row or its uploads once a send started. `Failed` current drafts resume; unreadable dates do not.
- Draft sync skips upload-progress ticks. `addCat` is idempotent; Cat Form save commits once; annotate mints cat ids from fresh state. Removed photos are pruned from cats. A failed startup restore retries on the next draft action. Reports reads ignore stale responses and always clear the refresh spinner.

Tests: `useSubmissionSubmit.inFlight.test.ts` (lock, retry, cleared draft, Failed row), `submissionCache.serial.test.ts` (status and index races; both fail on the old code), `draft.startup.test.ts` (mid-send kill kept), `uploadNewPhoto.queue.test.ts` (dedupe, retry, cancel). Not checked on device.

## 2026-11-02 — fix (photo cap and counter)

**Purpose:** `MAX_PHOTOS` was never enforced, so an 11th photo failed its upload silently; `photoCount` drifted under duplicate, overwrite and out-of-order Storage events; a same-size overwrite skipped the content-type check.
**Change:** See ADR-0005's 2026-11-02 amendment. Client cap at shutter, burst loop and library picker (`photoSlotsLeft`, `showPhotoLimitReached` in `usePhotoStore`); library time classified over the whole pool. Per-object marker docs make both count triggers idempotent, with `retry: true`. Rules: patch branch needs equal size, type and md5; `user_id` must match the path; metadata retries pass the 250 cap. Tests: `functions/src/__tests__/photoCount.test.ts` (event-sequence model; replaces the call-shape cases), three new cases in `__tests__/rules/storage.test.ts` (emulator run: 39 passed), library cap case in `useLibraryPhotoPicker.selection.test.ts`.

## 2026-11-03 — refactor (no Firestore)

**Purpose:** Owner decision: the project does not use Firestore. The photo and Submission caps depended on Firestore counters.
**Change:** See ADR-0005's 2026-11-03 amendment. Photos are named by `upload_slot` (`photo-0` … `photo-9`), which `storage.rules` enforces; `usePhotoStore` assigns slots, and the pickers upload the stored, slotted copy. The 250-Submission cap is an Auth claim kept in step with the uid's `metadata.json` count. `firestore.rules`, its emulator and tests, and the photo-count triggers are removed. Rules tests run on a `demo-` emulator project. Tests: `usePhotoStore.slots.test.ts`, `functions/src/__tests__/submissionCap.test.ts`, rewritten `__tests__/rules/storage.test.ts` (emulator: 17 passed).

## 2026-11-03 — fix (photo formats and removal)

**Purpose:** Design review found three photo bugs: a library pick in a format storage.rules refuses (e.g. webp, gif) sat un-uploaded with no message; the camera's discard cleared only the photo store, leaving the photo's boxes and cat references; and a removed photo's upload kept running.
**Change:** `utils/photoFormat.ts` holds the accepted formats; the library picker skips others and says so. `removePhotoFromDraft` (hooks) is the one removal path for annotate and camera: cancels the photo's upload (`cancelPhotoUpload`), clears its boxes and cat references, removes it, and best-effort deletes its uploaded copy (`deleteSubmissionPhoto`). ADR-0006 amended: its Settings "Clear Draft" caller was removed in `9c2084a`. Tests: `removePhotoFromDraft.test.ts`, format case in `useLibraryPhotoPicker.selection.test.ts`.

## 2026-11-03 — refactor (upload facade)

**Purpose:** Five call sites each assembled uid, Submission id and `updatePhoto` and had to upload the store's slotted copy (one didn't); Submit polled the store for 30 s, so a failed upload surfaced only at the timeout.
**Change:** `lib/upload/draftUploads.ts`: `syncPhotoUploads()` (no arguments; reads auth store and photo store), `cancelPhotoUpload(localId)`, `cancelPhotoUploads()`, `whenUploadsSettled(timeoutMs)` → `'uploaded' | 'failed' | 'timeout'`, event-driven from the photo store and a new queue idle signal. `uploadNewPhoto.ts` is now the queue only; `retryPendingUploads` and the Submit poll are gone. Camera, library, Details, Submit and teardown use the facade. Test: `draftUploads.test.ts` (slotted copy, immediate failure, timeout).

## 2026-11-03 — refactor (draft lifecycle)

**Purpose:** The submit lock was checked by hand in four places, and the In Progress → Sending → Submitted/Failed status machine was written by bare cache updates in three files.
**Change:** See ADR-0006's 2026-11-03 amendment. `submitDraft()`/`discardDraft()`/`isDraftBusy()` in `lib/submission/draft.ts`; the send pipeline moved to `lib/submission/send.ts`; `transitionSubmission()` and `UNSENT_STATUSES` in `submissionCache.ts`. `useSubmissionSubmit` keeps only the confirm, the messages and navigation. Test: transition table in `submissionCache.serial.test.ts`; the submit-flow tests now seed the auth store.

## 2026-11-08 — fix

**Purpose:** Apply the chosen user-facing Sighting terminology consistently (#380).
**Change:** Home continuation/draft notices, form title, final Submit Sighting action and counted confirmation, reset dialog, retry/failure messages, and history labels use Sighting. Internal Submission models, routes, telemetry, storage keys, and APIs are unchanged. No rescue-response or receipt behavior is added. Existing rendered journeys/assertions are updated with the wording. Device truncation/accessibility acceptance remains open. See the [history note](2026-10-26-feat-reports-history-map.md) and [backlog audit](../planning/2026-11-08-backlog-2026-11-07.md).

## 2026-11-11 — refactor

**Purpose:** Move submission confirmation, failure and discard copy to its canonical
configuration owner as requested by second-pass SP2.
**Change:** Submit and discard/exit UI consume the submission namespace in the
existing shared text configuration, including named count templates and camera-roll
notices. No lifecycle state transition, validation requirement or persistence
boundary changes. Shared validation messages also consume centralized copy.
See [shared UI work](2026-10-28-ui-component-spacing-alignment.md) and the
[review](../reviews/2026-11-11-review-ui-ux.md) for verification.

## 2026-11-12 — test cleanup

**Purpose:** Prevent deferred photo deletion from accessing Expo after Jest teardown.
**Change:** The row-creation regression test now matches `completeDraft`'s synchronous
photo cleanup instead of requesting deferred deletion. It uses Expo's real file
wrapper and supplied native mock to assert that the captured cache file is deleted
before the cleanup call returns. Production deletion timing is unchanged.
