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
- **Reason:** `submission.captured_at` is the *earliest* EXIF time across a multi-select Library pick (`ADR-0003`'s interim rule) — correct as a submission-level approximation, but stamped onto every photo it would misdate every photo except the earliest one.
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

| Test file | What it verifies |
| --- | --- |
| `__tests__/hooks/useSubmissionSubmit.submitFlow.test.ts` | Only fully-uploaded photos submit; box geometry with `cloud_storage_path` in payload; salted hash reuse (`hashUid` called, not a separate re-derivable hash); per-photo `captured_at`/EXIF preference over submission-wide earliest; best-effort finalize via `Promise.allSettled` doesn't fail submission on a rejected patch; submit proceeds regardless of consent state |
| `src/hooks/__tests__/useSubmissionSubmit.cacheSync.test.ts`, `.reset.test.ts` | Updated mocks for the new `firebaseUpload` exports; unaffected reset behavior |
| `src/lib/upload/__tests__/firebaseUpload.hashUid.test.ts` | `hashUid` salts before hashing (matches a Node-`crypto` reference computation); deterministic; salt actually changes the output vs. unsalted `sha256(uid)` |
| `src/hooks/__tests__/useBoundingBoxStore.test.ts` | `getBoxesForCat` returns every box across a cat's photos, excludes other cats (string-prefix-match key scheme) |
| `__tests__/rules/storage.test.ts` | Owner can upload/patch under their own `uidHash` folder; another uid cannot; photo-count cap; `metadata.json` write shape/cap, bypasses the photo-count gate; metadata-only patch bypasses the count gate; #267/#268 regression markers (still failing, by design — document the known gaps) |
| `functions/src/__tests__/index.test.ts` | `onSubmissionPhotoUploaded`/`onSubmissionPhotoDeleted` set/decrement `photoCount` and `ownerUidHash`; no-op on malformed paths and on `metadata.json` |
| `__tests__/utils/api.test.ts` | `submitObservation` describe block removed with the dead code |

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

- **Finding:** `submission.captured_at` is the *earliest* EXIF time across a multi-select Library pick — correct as a submission-level value, but stamped per-photo it misdates every photo but the earliest.
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
