# Code audit — logic

Reviewed 2026-11-24 on `review/sonnet-code-audit` at `880c9b9`. Scope: `src/`, `functions/src/`, `modules/*/src/` (JS only), plus `storage.rules` and `firestore.rules`. `node_modules` is absent, so the review is static: no test was run, and no claim here says a test passes or fails.

Read in full for tracing: the Draft Submission boundary (`draft.ts`, `send.ts`, `payload.ts`, the four stores, `submissionCache.ts`, `useDraftSync`, `useSubmissionSubmit`, `catPass`, `useActiveCatFlow`, `useCatSubmit`), the upload pipeline (`draftUploads`, `uploadNewPhoto`, `photoSlotQueue`, `firebaseUpload`, `uploadAdmission`), Live fix and the Map picker, the Library pick and camera capture hooks, consent and permissions, auth, organizations (client store, `functions/src/organizations/**`), `functions/src/index.ts`, `uploads/**`, `erasure/**`, and both rules files. Skimmed only: the annotate gesture hook and components, and UI atoms.

## Summary

- 1 P1, 5 P2, 8 batched P3 (LOGIC-7 to LOGIC-14), plus 4 test findings.
- **P1.** A Library pick without EXIF time can be submitted with no Submission time at all. The photos' `photo_time` then silently becomes "now". ADR-0003 says a validation gate prevents this, and no such gate exists (LOGIC-1).
- **P2, draft-level metadata.** A Library draft that is emptied and then continued from the camera keeps `location_type: 'pin'` and the old time. The Live fix is ignored, and the stale pin shows a green check (LOGIC-2).
- **P2, draft expiry.** A photo draft is dated only by photo-pool changes. Cat edits and boxes do not extend its life, so a worked-on draft and its uploaded photos can be discarded at the next launch (LOGIC-3).
- **P2, data completeness.** Per-photo time lives only in best-effort Storage metadata, and `metadata.json` has no time for camera captures. A swallowed patch failure loses the time permanently (LOGIC-4).
- **P2, upload admission.** At most 3 Submissions may hold a live upload grant (30-minute TTL), and the refusal reason is never shown. A fourth Sighting within 30 minutes cannot upload (LOGIC-5).
- **P2, erasure.** Account erasure leaves pin comments and reactions keyed by the erased uid (LOGIC-6).

## Findings

### LOGIC-1 — P1: A Library pick with no EXIF time can be submitted with no time; the Sighting is recorded as "now"

**Where:** `src/shared/utils/validation.ts:11`, `src/features/draft-submission/lib/draft.ts:237`, `src/features/draft-submission/screens/create/index.tsx:156,294`, `src/features/draft-submission/lib/payload.ts:90` · **Basis:** source · **Confidence:** confirmed

**Evidence:**

```ts
// validation.ts — the only content gate submitDraft applies
return [
  ...(catCount === 0 ? [validationCopy.missingCatObservation] : []),
  ...(photoCount === 0 ? [validationCopy.missingPhoto] : []),
]
// payload.ts resolvePhotoTime: ... ?? submission.manual_time ?? fallbackTime
// send.ts:148  const submitFallbackTime = new Date().toISOString()
```

The Create screen disables Submit only at `cats.length === 0` (`create/index.tsx:294`). A manual-time draft with no `manual_time` shows an amber icon (`status.ts`, `time: true`) and nothing else.

ADR-0003 line 12 says "the existing validation gate (`validation.ts`) already requires `manual_time` before submission". `useSubmissionSubmit.ts:8` says the warning is "informational, not a submit gate (ADR-0002/0003)". **Contradicts ADR-0003's own gate claim.** The code follows the second statement, and the ADR text is stale or wrong.

**Human path / failure scenario:**

1. The user picks 2 library photos that carry no EXIF `DateTime` (screenshots, photos forwarded by messaging apps), taken three days ago.
2. `classifyLibraryPickTime` returns `manual`, and `setLibraryTime` clears `manual_time`.
3. On Submission Details the time row shows a warning icon next to a picker whose default label is today's date and time (`create/index.tsx:162-171`: `value={... : new Date()}`). The user does not open it, because the date shown looks set.
4. They tap Submit Sighting and confirm. `missingDraftContent` passes.
5. `metadata.json` carries `time_type: 'manual'` with no `manual_time` and no `captured_at`.
6. Each photo's `photo_time` is written as the submit moment, and `sightingTime` in History falls to `submitted_at`.
7. The research database records a three-day-old sighting as "now". This is exactly the failure ADR-0003 exists to prevent.

**Fix:** Decide the ADR question first. If a gate is intended (ADR-0003's text), add a hard block in `submitDraft` beside `missingContent()`. For example, return `incomplete` when `submission.time_type === 'manual' && !submission.manual_time`, reusing `draftWarnings` from `lib/status.ts` and `missingDraftContent` in `validation.ts`. If the informational reading is intended, correct ADR-0003 and at least stop pre-filling the picker with `new Date()` as though it were a chosen value.

---

### LOGIC-2 — P2: Draft-level location and time are not re-derived when a Library draft is emptied and continued from the camera, or when a Library photo is removed

**Where:** `src/features/draft-submission/hooks/removePhotoFromDraft.ts:45`, `src/features/library-picker/hooks/useLibraryPhotoPicker.ts:120,128`, `src/features/draft-submission/hooks/useDraftSync.ts:127`, `src/shared/hooks/useSubmissionStore.ts:164,178` · **Basis:** source · **Confidence:** confirmed

**Evidence:**

```ts
// useDraftSync.ts:127 — the Live fix is dropped for a 'pin' draft
if (submission.location_type === 'pin') return
// useLibraryPhotoPicker.ts:120 — the only place a Library draft is set to 'pin'
if (isFirstPick) setLocationType('pin')
```

`removePhoto` clears `source` when the pool empties (`usePhotoStore.ts:138-146`). Nothing resets `location_type`, `latitude`/`longitude`, `time_type`, `captured_at` or `manual_time`. The camera path (`useCameraCapture`, `useNativeCameraCapture`) never calls `setLocationType` or `setLibraryTime`. Only a new Library pick re-derives them.

**Human path / failure scenario:**

1. Home → Upload Photos → pick 1 photo. The draft becomes `location_type: 'pin'`. The user sets a map pin at the colony.
2. On Annotate the user long-press-removes that photo. The pool is empty, `source` is `null`, and the cat records stay.
3. The user goes Home. Take Photos is enabled, because `camera.disabled` depends on `source === 'library'` only. They take two camera photos and continue.
4. `startLocationCapture` runs, and the fix resolves. The `useDraftSync` effect returns early because the draft is `'pin'`, so the Live fix is never committed.
5. Submission Details shows a green check on Location ("manual"), carrying the old pin's coordinates. Camera photos are submitted at the wrong place with no warning.
6. The time fields are stale in the same way. The removed Library photo's `captured_at` (earliest EXIF) or `manual_time` stays in `payload.submission`.

Related, without the camera: with two Library photos A (EXIF 10:00) and B (EXIF 09:00), `captured_at` is 09:00. Removing B leaves `captured_at: 09:00` in `metadata.json`, while the remaining photo says 10:00. The earlier "classified over the whole pool" fix (`useLibraryPhotoPicker.ts:122-129`) runs only on pick, never on removal. Likewise, removing the photo that lacked EXIF leaves the draft forced to `manual`.

**Fix:** In `removePhotoFromDraft`, after `removePhoto`, re-run `classifyLibraryPickTime` over the remaining pool when `source === 'library'`, calling `setLibraryTime`. When the pool empties, reset draft-level location and time as the camera would expect: `setLocationType('device')` (it already clears coordinates when the type changes), and a `time_type: 'device'` reset. `usePhotoStore`'s `source: null` is the signal that the single-source lock was released, so reset there. The single-source rule is in domain.md under Library pick.

---

### LOGIC-3 — P2: A photo draft's lifetime is dated by photo-pool changes only, so cat edits do not keep it alive

**Where:** `src/features/draft-submission/lib/draft.ts:173-181`, `src/features/draft-submission/hooks/usePhotoStore.ts:111,127,138-146` · **Basis:** source · **Confidence:** confirmed

**Evidence:**

```ts
const lastChange =
  photos.length > 0
    ? updated_at // only addPhoto/addPhotos/removePhoto write this
    : hasCats && row
      ? Date.parse(row.updated_at)
      : null
```

`updated_at` is set only on photo add or remove. `updatePhoto`, cat edits, boxes, manual time and the pin do not touch it. Meanwhile `useResumableDraft` and Reports date the draft by the row's `updated_at`, which `syncDraftToRow` refreshes on every cats or photos change.

**Human path / failure scenario:**

1. The user photographs a colony on Monday 09:00 and annotates and describes cats on Monday 21:00. The row is fresh.
2. They close the app and reopen it Wednesday 10:00, which is 49 hours after the last photo change and 37 hours after the last real work.
3. Start-up `discardUnsurvivingDraft` finds `now - updated_at > 48h` and calls `tearDownDraftState(true)`. It also deletes the history row, and `deleteSubmissionUploads` removes the photos already uploaded.
4. Home no longer offers Continue Observation, and the cats and boxes are gone. The draft's own `SUBMISSION_STALE_MS` doc says "last changed", and Home had offered resume on the strength of the fresher row.

**Fix:** Date a photo draft by `max(updated_at, row.updated_at)`. This is the smallest change, and the row is already read on the line above. Alternatively bump `updated_at` from cat and box writes.

---

### LOGIC-4 — P2: A Sighting's per-photo time lives only in best-effort Storage metadata; `metadata.json` has no capture time, and a failed patch is swallowed

**Where:** `src/features/draft-submission/lib/send.ts:154-175`, `src/features/draft-submission/lib/payload.ts:90-101,193-196` · **Basis:** source · **Confidence:** confirmed

**Evidence:**

```ts
// send.ts: failures are logged and the submit still reports success
const finalizeResults = await Promise.allSettled(
  finalizeTargets.map(({ path, photo }) =>
    finalizeSubmissionPhotoMetadata(
      path,
      userId,
      photoTimeFor(photo),
      latitude,
      longitude,
      photo.camera_config,
    ),
  ),
)
```

The payload carries `submission.time_type` and `captured_at` or `manual_time` only for Library or manual drafts. For a camera Sighting there is no time field anywhere in `metadata.json`. `submitted_at` is written to the local history row (`send.ts:87`) and never into the payload. The `photo_locations` list exists for location, and no `photo_times` counterpart exists. The shutter time (`SubmissionPhoto.captured_at`) is local only until finalize runs.

ADR-0003 (line 7) says `submitted_at` "_is_ the sighting time". **Contradicts ADR-0003's code description**: `submitted_at` is not in the uploaded record. The "ADR-0003 consumption unverified" note covers whether a backend reads it, not that it is absent.

**Human path / failure scenario:**

1. A camera Sighting is submitted on a flaky connection.
2. One photo's `getMetadata` or `updateMetadata` rejects (offline during the patch). `allSettled` swallows it, and the user sees a successful Submit.
3. The draft is torn down, and the camera file is deleted.
4. That Storage object has no `photo_time`, `user_id` or location. The ML export reads images separately from `metadata.json`, and the shutter time is not recoverable anywhere.
5. The comment at `send.ts:150-153` justifies best-effort by "missing photos" being the P0. That holds for the bytes, not for their time.

**Fix:** Include the already-computed per-photo time in the payload, next to `photo_locations`, for example `photo_times: {path, time}[]` built from `resolvePhotoTime` in `buildSubmissionPayload`. That makes `metadata.json` the durable copy, and the patch becomes an enrichment. Optionally retry the failed patches once before the Submit is reported. Update ADR-0003's description of `submitted_at` either way.

---

### LOGIC-5 — P2 (plausible): A fourth Sighting within 30 minutes cannot upload; every admission refusal reaches the user as a generic stall

**Where:** `functions/src/uploads/admission.ts:190`, `functions/src/submissionLayout.ts:71-74`, `src/features/draft-submission/lib/upload/uploadAdmission.ts:80`, `src/features/draft-submission/lib/upload/uploadNewPhoto.ts:156` · **Basis:** source · **Confidence:** plausible (depends on the 30-minute pattern)

**Evidence:**

```ts
// admission.ts:190
if (Object.keys(liveGrants(own, now)).length > MAX_GRANTED_SUBMISSIONS)
  // = 3
  throw new AdmissionError(429, 'too_many_open_submissions')
```

Each admission sets `e = now + 30 min` for that submissionId. A submitted Sighting's grant stays live until it lapses. `UploadAdmissionError` is constructed on the client and never inspected. `uploadNewPhoto` logs it, `uploaded` stays `false`, and Submit eventually shows the generic "Photos Still Uploading". The 250-lifetime cap (`submission_cap_reached`) and `quota_exceeded` are treated the same way.

**Human path / failure scenario:** A volunteer logs four separate spots (domain.md: "Separate places need separate Submissions") within half an hour, each Sighting taking a few minutes. The first photo of the fourth gets a 429. The photo shows a failed upload, Submit stalls after 30 seconds, and nothing says why or that waiting up to about 30 minutes is the cure.

**Fix:** Either release a Submission's grant when its `metadata.json` finalizes (the `onSubmissionSubmitted` trigger already runs on that object), or raise `MAX_GRANTED_SUBMISSIONS` within the 1000-byte claim budget. Also map `UploadAdmissionError.reason` to specific copy in `uploadNewPhoto`'s failure path. Existing tests assert the server-side throw (`admission.test.ts:153-157`) and nothing on the client.

---

### LOGIC-6 — P2: Account erasure leaves pin comments and reactions keyed by the erased uid; the exit policy has no caller

**Where:** `functions/src/organizations/store.ts:475-497`, `functions/src/organizations/interactions/store.ts:250` · **Basis:** source · **Confidence:** confirmed

**Evidence:**

```ts
// store.ts:491
// TODO: erasure policy for pin comments and reactions: keep them, but
// redact the author's user info. Today `pinComments` and `pinReactions`
// still hold `authorUid` after erasure
```

`eraseOrganizationData` deletes `organizationPermissions`, `organizationMemberships`, `states` and `mutations` only. `applyAuthorExit` (the policy owner) has no callers in `functions/src` or `scripts/`. `leaveOrganization` and `moderateMembership('remove')` also leave comments in place.

This is consistent with ADR-0008's list of what erasure removes, which does not name pin interactions. The code comment calls it unfinished, so it is an open gap, not a regression.

**Human path / failure scenario:** A member posts a comment containing a phone number or a location. They delete their account with sightings deleted. `deleteAccount` returns `{ deleted: true }`, but the comment body and the erased uid remain in `pinComments`, readable by the organization (author shown as null).

**Fix:** Decide the policy before the deletion guard (#433) is wired to a screen. Call `applyAuthorExit('delete', uid)` from `eraseOrganizationData` (`interactions/store.ts:250` already does the deleting and the `commentCount` adjustment), or redact `authorUid` as the TODO proposes. The comment-limit adjustment skips accounts with `deleting` set, so call it before the tombstone is written.

---

### P3 — minor, batched

- **LOGIC-7** `src/features/draft-submission/hooks/useDateTimePicker.ts`, `DateTimePicker.tsx:100`: a manual time can be in the future. `maximumDate` is passed to the date step only (the iOS time step at `:100` has none, and Android's time dialog ignores it). Choosing today plus a later time is accepted, and nothing validates `manual_time <= now` in `setManualTime` or at submit. _Fix:_ clamp in `handleManualTimeChange` (`create/index.tsx:78`).
- **LOGIC-8** `functions/src/organizations/domain.ts:341`: `Math.floor(latitude * 100) / 100` is off by one cell for values such as 34.29 (3428.9999999999995 floors to 34.28), so the "general location" cell may not contain the point. Harmless to privacy, wrong to coverage. _Fix:_ round to a stable precision before flooring.
- **LOGIC-9** `src/features/history/lib/history.ts:183-184`: the comment says a Library pick's local file survives teardown, but `capturedPhotoFiles.ts:24-25` deletes any file under `Paths.cache`, which is where the image picker copies picked assets. The offline fallback for a Library Profile Pic therefore probably does not exist after Submit (plausible). _Fix:_ check where `expo-image-picker` writes, then fix the comment or the ownership test.
- **LOGIC-10** `src/shared/lib/submissionCache.ts:134-139`: `readIndex` returns `[]` on a JSON parse error, and the next `writeIndex` then overwrites the index, dropping every history id. _Fix:_ rethrow on parse error, or rebuild the index from `submission_cache_*` keys.
- **LOGIC-11** `src/features/draft-submission/lib/upload/uploadAdmission.ts:23`: the held-grant cache key `${submissionId}/${slot}/${raw}` omits the uid. A different account continuing the same draft would skip the admission request and fail with `storage/unauthorized`, though the app has no sign-out control today, so it is unreachable. _Fix:_ include the uid if sign-out is ever added.
- **LOGIC-12** `functions/src/organizations/api.ts:165-168`: `makePermission` runs the coverage check on `latitude`/`longitude` read from `metadata.json`, which `storage.rules` lets the owner overwrite (`isValidMetadataWrite` checks size and content type only). An owner can share a Sighting outside an organization's coverage. Low impact, since it is their own data. _Fix:_ if coverage must be authoritative, derive it from server-side state.
- **LOGIC-13** `functions/src/organizations/membership/service.ts:26`: any `getAuth().getUser` failure, including a transient Auth outage, becomes a 400 "Account name required". The user is told to fix their profile. _Fix:_ map only a missing or empty `displayName` to 400, and rethrow others as 503.
- **LOGIC-14** `src/shared/lib/geometry/cropProjection.ts:14`: the comment says the photo is "scaled down (never up)", but `containFit` uses `Math.min(canvasW/imgW, canvasH/imgH)`, which exceeds 1 for a photo smaller than the canvas. All callers use the same function, so the math is consistent. _Fix:_ correct the comment.

## Test findings

### LOGIC-T-1 — Coverage gap: no test submits a manual-time draft without `manual_time`; the fallback test encodes the "now" behavior

**Where:** `src/features/draft-submission/lib/__tests__/payload.test.ts:146`, `src/features/draft-submission/hooks/__tests__/useSubmissionSubmit.submitFlow.test.ts` · **Basis:** test-read
`payload.test.ts:146` ("falls back to the given fallback time when nothing else resolves") asserts the fallback is the submit time. No test exercises `time_type: 'manual'` with no `manual_time` through `submitDraft` (LOGIC-1). The realistic mutation it would miss: removing the fallback or adding a gate changes nothing visible in the suite.

### LOGIC-T-2 — Coverage gap: no test runs Library pick → remove all → camera capture

**Where:** `src/features/library-picker/hooks/__tests__/useLibraryPhotoPicker.selection.test.ts`, `src/features/draft-submission/hooks/__tests__/removePhotoFromDraft.test.ts` · **Basis:** test-read
The picker tests reset `photos`, `source` and `submissionId` in `beforeEach` and assert the draft state after a pick. None removes the photos and then captures from the camera or checks `location_type` or `captured_at` afterwards (LOGIC-2). A model test over Library draft, Remove, Camera would hit it.

### LOGIC-T-3 — Never fails for its purpose: start-up survival tests vary only the photo timestamp

**Where:** `src/features/draft-submission/lib/__tests__/draft.startup.test.ts:93,199` · **Basis:** test-read
"discards the whole draft once its last change is past the window" seeds `updated_at` only, and "discards an undated pool even when its current cache row is fresh" (`:199`) asserts today's behavior. No case seeds a photo draft with a stale pool and a fresh row or cat edit (LOGIC-3), so changing `lastChange` to `max(...)` would not be caught, and neither would the current bug.

### LOGIC-T-4 — Misses regressions: the finalize-failure test locks in silent loss

**Where:** `src/features/draft-submission/hooks/__tests__/useSubmissionSubmit.submitFlow.test.ts:315` · **Basis:** test-read
It asserts `uploadSubmissionMetadata` was called and no failure dialog shows when one `finalizeSubmissionPhotoMetadata` call rejects. It does not assert that the failed photo's time or location is recoverable. It would pass equally whether the time is lost (LOGIC-4) or kept in `metadata.json`. The dialog title check is real (`text.ts:404` is `'Sighting Failed'`), so it is not vacuous.

## Handoffs

- `duplication`: `src/core/location/liveFix.ts:46` (`DEV_STUB_LOCATION`) and `src/features/draft-submission/screens/location-picker/usePinCenter.ts:13` (`DEFAULT_REGION`) hold the same coordinates.
- `duplication` / `mvvm`: `src/features/organizations/interactions/hooks/usePinInteractions.ts:22` imports `@/functions/src/organizations/interactions/domain` from app code, crossing the `src` / `functions` project boundary.
- `navigation-ui`: `src/features/draft-submission/screens/create/index.tsx:162-171` pre-fills the manual-time picker with `new Date()`, so an unset time reads as set (the UI half of LOGIC-1).
- `navigation-ui`: `src/shared/hooks/useUIStore.ts:70` keeps a single dialog slot, so `showAlert` overwrites an open dialog, for example an upload-failure alert replacing a pending confirm.

## Not reviewed

- Annotate gesture code (`useBoundingBoxFrame.ts`, `AnnotateCarouselItem.tsx`, `InsetCropBubble.tsx`): only the pure geometry in `shared/lib/geometry/` and `annotate/lib/` was traced. The reanimated worklet code is not covered statically.
- `modules/*/src/` (thin wrappers) and Kotlin/Swift (out of scope).
- Emulator and rules tests (`functions/src/**/emulator-tests`, `__tests__/rules/`): not read, so I make no claim about whether `storage.rules` allows or denies a given write beyond the rule text. The rules-vs-functions agreement on grants was checked by reading both sides only.
- UI screens and atoms beyond the logic paths cited (layout, styling, accessibility) belong to other lenses.
- `functions/src/email/**`: read only by signature.
- No test was run, because `node_modules` is absent.
