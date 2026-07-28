# Session handoff (2026-07-28) — location services implementation

Branch: `issue-47-location-services` (from `main`). Issues: **#47** device-GPS
capture (reused as geolocation half) + **#102** map picker. Single PR planned.

## Decided this session (grilling + domain-modeling)

Recorded in `docs/adr/0002-location-services-model.md` and `CONTEXT.md` (both
committed on this branch, `dca3302`). Summary:

- **One Submission location per Submission**, shared by all photos. Info
  affordance: "Separate locations need separate submissions."
- **Source-based trust:**
  - Camera capture + good GPS → a single **Live fix** taken once per
    Submission; authoritative, **not** user-editable.
  - Camera capture + GPS denied/timeout → fall back to the **Map picker**.
  - Uploaded (library) photo → **Map picker**, seeded from photo EXIF if
    present.
- **Keep `expo-location`** (already installed). Do **not** swap to
  `react-native-geolocation-services`.
- **Map picker = `expo-maps`** (`GoogleMaps`/`AppleMaps` native views), fixed
  center pin as an RN overlay, `onCameraMove.coordinates` = the center; "Set
  location" commits, cancel returns unset. Seed order: photo EXIF →
  last-known device position → default region (~Clemson).
- Location is an **app-level JSON value** on the submission/photo — **no**
  rewriting GPS into image EXIF bytes.
- `expo-maps` is **alpha** in SDK 56 — accepted for the Android-only MVP.

Deferred (not this work): address entry / autocomplete (pending nonprofit
partnership), EXIF-vs-selected agreement validation, actual-byte EXIF embedding.

## `LocationMethod` mapping (existing enum in `submissionCache.ts`)

`device` → Live fix · `pin` → Map picker · `address` → deferred.

## Test constraint

**Only** state-machine program-flow tests for these screens — no
component/util tests. Production stays plain React + Zustand (no xstate in
`src/`). Model the flow as an xstate `createMachine` **in the test** and walk
all paths with `@xstate/graph` `createTestModel`. Precedent to copy exactly:
`src/screens/home/__tests__/HomeScreen.gate.model.test.tsx` (on branches
`issue-67-*` / `issue-7-*`; not yet on `main`). File naming: `*.model.test.tsx`.
`xstate` + `@xstate/graph` are already in devDependencies.

## Key findings (production wiring)

- `validateSubmission` (`src/utils/validation.ts:123`) **already requires**
  `latitude`/`longitude` for `location_type` `device`/`pin`, but
  `SubmissionDraft` (`src/hooks/useSubmissionStore.ts`) has no such fields and
  the create screen never sets them → today Continue is effectively broken for
  device/pin. This is the #47 gap.
- **Two competing location concepts today** to be unified into one Submission
  location:
  - `usePhotoSession.ts` stamps a fresh GPS fix into each `photo.exif`
    (per-photo, via `captureCurrentLocation`).
  - Create screen expects a submission-level coordinate (unset).
- `CacheMetadata` (`submissionCache.ts:42`) already has slots:
  `location_method` (how) + `location_type?: LocationType` (the coords). Reuse
  `location_type` for the persisted coordinate.
- `captureCurrentLocation` (`src/lib/location.ts`) already exists: consent-
  gated, foreground-permission-checked, 4s timeout, `__DEV__` stub near
  Clemson. Refactor its call site from per-photo to per-submission.

## Plan — two slices, same branch/PR

### Slice A — Live fix (no new deps; safe, do first)

1. `SubmissionDraft`: add `latitude?`, `longitude?`, `accuracy?`; add
   `setSubmissionLocation(loc)` setter. Persist via existing store.
2. Create screen `device`: acquire one Live fix per submission (reuse
   `captureCurrentLocation`); store coords; on deny/timeout route to map
   picker as fallback.
3. Unify: `usePhotoSession` stops per-photo GPS stamping; photos inherit the
   single Submission location.
4. Persist coords into `CacheMetadata.location_type` on save.
5. FSM `*.model.test.tsx` for the flow: device→fix, device→fail→picker,
   pin→picker, picker-confirm, picker-cancel.

### Slice B — Map picker (`expo-maps`, native, BLOCKED)

Blocked on: **Google Maps API key** (create in Google Cloud, add to Android
config) — user must provision. Steps once unblocked:

1. `npx expo install expo-maps`.
2. Config plugin + API key in `app.json` / native config.
3. `expo prebuild` (regenerates `android/`).
4. Map-picker screen: `src/app/submission/location-picker.tsx` (route) +
   `src/screens/submission/location-picker/` (screen). Fixed center pin
   overlay, seed chain, "Set location" writes coords to store + navigates back.
5. Extend the FSM model test with the real picker screen.

## Immediate next step on reconnect

Confirm sequencing choice (was mid-decision: "prep a handoff in case of lost
connection"). Then start **Slice A** — it needs no API key and no native
rebuild. Hold Slice B's `expo install` / `prebuild` until the Google Maps API
key is available.

## Do not touch

Stray untracked files carried from the Firebase branch tree —
`.firebaserc`, `firebase.json`, `google-services.json` — are out of scope for
this branch. Leave them untracked; do not commit.
