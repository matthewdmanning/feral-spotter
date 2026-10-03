# Sprint:camera planning (2026-07-31)

Grilling session output. Scope: #121 (parent) → #122, #123, #104, #105. Not yet implemented — this is the build spec.

## Build spec

### #122 — Remove redundant Settings button

Mechanical, no decision. `src/screens/home/index.tsx:69-78` — delete the `headerRight` `Pressable` (Settings icon → `/settings`). Keep `headerShown: true`, `title: "FeralSpotter"`, and the existing Settings tab (`src/app/(home-tabs)/_layout.tsx:47-53`) untouched.

### #105 — Camera icon label

Add "Take a Photo" caption under the camera button in `src/screens/home/index.tsx`.

### #104 — Manual-upload entrypoint (full flow)

**Delete (dead, pre-dates Cat Observations photo-pool redesign):**

- `src/hooks/usePhotoSession.ts`
- `src/screens/submission/photos/` (index.tsx + styles + tests)
- `src/app/submission/photos.tsx`
- `'photos'` entry in `STEPS` array, `src/app/submission/_layout.tsx:13,52-62`

**Check before deleting:** `useUIStore.sessionPhotos`/`addSessionPhoto`/`removeSessionPhoto` (`useUIStore.ts:18-45`) are written by the _live_ `useCameraCapture.tsx:81-82,131,171` on every shutter press, but once `PhotosScreen` (the only reader) is deleted, nothing reads `sessionPhotos` anymore. Decide at implementation time whether to strip those write calls from `useCameraCapture.tsx` too (dead write) or leave them (harmless, unread) — not decided this session, flagging so it isn't missed.

**Build new:**

- Library picker (new hook, e.g. `useLibraryPhotoPicker.ts`): `expo-image-picker`'s `launchImageLibraryAsync({ allowsMultipleSelection: true, exif: true })`. For each picked asset, build a `SubmissionPhoto` (same shape `usePhotoSession.ts:87-105`'s `buildPhoto` already used — reuse that logic) and call `addPhoto`/`addPhotos` directly on `usePhotoStore` — no staging/review screen, mirrors camera's direct-add.
- Home screen: two equal-size stacked buttons — camera on top ("Take a Photo"), library on bottom ("Choose from Library"). Multi-select on.
- Navigate to `/submission/create` after picking, same destination as camera's `handleDone` (`useCameraCapture.tsx:185-188`).
- Permission: rely on `launchImageLibraryAsync`'s self-prompt (lazy, point-of-use) — do not add an eager `request()` call.

**#91 fix (photo-library slice only):** remove `mediaLibrary` from the consent screen's eager `Promise.all` in `src/screens/consent/index.tsx` (`handleAgree`, ~line 23-27). Camera/location eager-request pieces of #91 stay untouched.

**Time model (ADR 0003, `docs/adr/0003-time-capture-model.md`):**

- New optional field `submission.captured_at?: string` (ISO) — add to `useSubmissionStore.ts`'s submission shape + setter, and `SubmissionApiPayload`/`src/types/Api.ts`.
- Library pick with EXIF `DateTime` present → `time_type` stays `'device'`, `captured_at` = extracted ISO timestamp (trusted, not user-editable, no warning).
- EXIF absent → `time_type: 'manual'` → existing validation gate (`src/utils/validation.ts:143-146`) requires `manual_time`, filled via existing `DateTimePickerButton` (`src/components/organisms/DateTimePicker.tsx`, currently zero call sites — wire it in).
- Multi-select interim MVP rule: all selected photos have EXIF time → earliest one becomes `captured_at`. Any one missing → whole batch falls back to `'manual'`, one entry via the modal.
- Backend read order: `captured_at` if present, else `manual_time` if `time_type === 'manual'`, else `submitted_at` (unchanged camera-capture behavior).
- Submission Details "Date & Time Recorded" box: same warning-icon/tap-to-fix treatment `create/index.tsx` already has for low GPS accuracy — show warning when `time_type === 'manual'` and `manual_time` unset; tapping opens `DateTimePickerButton`.
- **Closes #94 in the same edit:** pass `maximumDate={new Date()}` to `DateTimePickerButton` (a sighting can't be in the future) — this is the picker's first real call site, and #94 ("Manual sighting date/time picker accepts invalid values — no min/max bounds") is exactly this component; the prop already exists (`DateTimePicker.tsx:16-20`), just unused everywhere.

**Location for library picks — settled after 3 advisor rounds (see ADR 0002's 2026-07-31 "single-source by construction" amendment):** `location_type` has no library-pick value today (only `'device'`/`'pin'`). Two arrival-order patches were tried and rejected — forcing `'pin'` unconditionally regresses a camera-first draft's trusted fix; gating the force on pool-emptiness just relocates the bug to whichever source arrives second, since a single Submission location can't correctly represent two different photos' real locations.

**Correct rule — a draft is single-source, enforced, not inferred:** once `usePhotoStore` holds any photo, the Home screen disables the entrypoint for the _other_ source until the draft is submitted or reset. A Library-sourced draft simply forces `location_type: 'pin'` at the first pick (pool guaranteed empty by the guard) — no arrival-order logic needed because mixed drafts can't occur. True per-photo/multi-place location remains #133 (Beta), unchanged.

**New implementation item:** Home screen (`src/screens/home/index.tsx`) needs to read `usePhotoStore.photos.length` and disable/hide whichever of "Take a Photo"/"Choose from Library" wasn't the source already used for the in-progress draft.

**`captured_at` threading — gap caught by advisor, fixed here:** the field must survive `useSubmissionStore` → `submissionCache.ts` → payload, not just store → payload. Add `captured_at?: string` to `CacheMetadata` (`src/lib/cache/submissionCache.ts:42-49`, alongside `manual_time`) so a resumed draft doesn't drop it. Backend consumption is **unverified passthrough, not read-order logic** — `src/app/*+api.ts` reads none of `time_type`/`manual_time`/`captured_at` today (MVP backend is validation-only); ADR 0003 corrected to say so rather than claim backend logic that doesn't exist.

**Location for library picks (unchanged besides the above):** ADR 0002 already routes any library-picked photo to the Map picker (seeded from EXIF GPS if present, user confirms).

**Explicitly deferred (own ticket, #133, Beta):** per-photo EXIF location/time sent to backend for real clustering across a multi-select batch. Breaks the "one Submission location/time" premise — real data-model change, not in scope here.

### #123 — Swipe-up to remove (replaces tap-X entirely)

`src/components/atoms/CameraThumb.tsx` — remove the `Pressable`+`X` remove button (lines 33-40). Add a vertical `Gesture.Pan()`, directional-locked (`activeOffsetY`/`failOffsetX`) so it doesn't steal the horizontal `FlashList` scroll — same idiom as `useBoundingBoxFrame.ts:161-204`'s gesture composition. Wrap in `GestureDetector`, drive `translateY`/opacity via Reanimated, call existing `onRemove` (→ `handleDiscardPhoto`, `useCameraCapture.tsx:167-174`) past threshold.

Accessibility: keep `accessibilityRole="button"` + add an `accessibilityAction` ("Discard photo") so screen-reader users have a non-gesture path — no visible second button.

## Files touched (implementation checklist)

- `src/screens/home/index.tsx`, `index.styles.ts` — remove Settings button, add label + library button, disable the unused-source entrypoint once the draft's pool is non-empty
- new `src/hooks/useLibraryPhotoPicker.ts` (or similar)
- `src/hooks/useSubmissionStore.ts` — add `captured_at`
- `src/types/Api.ts` — add `captured_at` to `SubmissionApiPayload`/submission shape
- `src/screens/submission/create/index.tsx` — wire Date & Time warning icon + modal
- `src/components/atoms/CameraThumb.tsx`, `.styles.ts` — swipe gesture
- `src/screens/consent/index.tsx` — drop mediaLibrary from eager Promise.all
- `src/lib/cache/submissionCache.ts` — add `captured_at` to `CacheMetadata`
- delete: `src/hooks/usePhotoSession.ts`, `src/screens/submission/photos/`, `src/app/submission/photos.tsx`; remove `'photos'` from `STEPS`
- `docs/adr/0003-time-capture-model.md` — already written (corrected: backend consumption is unverified passthrough, not read-order logic)
- `CONTEXT.md` — already updated (Submission time, Manual time, Library pick)

Tests needed: swipe-gesture removal + accessibility action; library-picker EXIF branching (device vs manual, multi-select earliest-wins / any-missing-manual); Home screen disables the unused-source entrypoint once the pool is non-empty (both directions); library pick forces `location_type: 'pin'`; `captured_at` survives a cache save/resume round-trip; consent screen no longer requests mediaLibrary; Date&Time warning/modal parity test in `create/index.tsx`; `DateTimePickerButton` rejects a future date (closes #94).

**Build risk, not a redesign item:** swipe-_up_ on a bottom-of-screen thumbnail strip may compete with the Android system home/back edge gesture — worth a manual test pass on-device, not a gesture-direction change.

## Decisions this session (brief reasoning)

- **Plan sprint:camera only, not cat-observations gaps** — no file overlap (`src/screens/camera/` vs `useCatSubmit.ts`), safe to isolate.
- **Fold #105/#103/#104 into #121, close #103** — same screen, one sprint umbrella beats two.
- **#104: build full flow, not just the button** — user override; entrypoint-only would leave Date&Time non-interactive with no real trigger to ever exercise it.
- **Discard `usePhotoSession`/`PhotosScreen`, add straight to shared pool** — that code predates the Cat-Observations photo-pool redesign; resurrecting it would duplicate `CatPhotoSelector`'s existing review UX.
- **Fix #91's photo-library slice now** — #104 touches the exact same permission path; leaving it eager would reintroduce the bug #91 already describes.
- **EXIF present → trusted + store `captured_at`; absent → manual** — mirrors ADR 0002's device-trust pattern; storing the value (not just a boolean) fixes a bug advisor caught (EXIF-trusted photos would otherwise silently record `submitted_at` = "now" instead of the real time).
- **Multi-select: earliest EXIF wins, any missing forces manual** — simplest rule consistent with the existing one-Submission-time schema; avoids guessing on data the app doesn't yet collect.
- **Per-photo EXIF clustering deferred to Beta (#133)** — real data-model change (breaks one-value-per-Submission), needs its own backend-contract grilling session, not a sprint:camera concern.
- **Swipe keeps an accessibilityAction fallback** — removing the tap-X drops the only screen-reader-reachable affordance otherwise; two input paths, no visible second button, no scope added.
- **Filed #134/#135 for Cat Observations gaps found during comparison** — doc scope items with no existing ticket (Re-review removal, Save routing); #135 flagged as non-mechanical since current routing reaches Box Annotation.
- **Home screen buttons: equal size, camera on top, library on bottom** — user's explicit layout call after rejecting the first two proposed copy/placement options.
- **A draft is single-source by construction; mixed camera+library is out of scope, not patched around** — advisor-caught gap, took 3 rounds: nothing set `location_type` for a library pick (round 1); an unconditional force downgrades a trusted camera fix (round 2); a pool-emptiness gate just relocates the mislocation to whichever source arrives second (round 3) — a single Submission location structurally can't represent two real locations, so no tiebreaker rule was ever going to be correct. Resolution: enforce single-source at the UI (disable the unused entrypoint once the pool has photos) so the mixed case can't occur; matches user's confirmation that camera and library are meant to be mutually exclusive per submission.
- **`captured_at` added to `submissionCache.ts`, ADR 0003's backend claim corrected to passthrough** — advisor-caught gap: the field was threaded through the store and API type but not the cache, and the ADR asserted backend read-order logic that doesn't exist anywhere in `src/app/*+api.ts` (MVP backend is validation-only).
- **`DateTimePickerButton` gets `maximumDate={new Date()}`, closing #94** — first real call site for this component; the bounds prop already existed and #94 is exactly the gap it fixes, found via the doc-vs-issues comparison that should've caught it the first time.
