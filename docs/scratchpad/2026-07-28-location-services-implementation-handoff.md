# Session handoff (2026-07-28) — location services (DONE, pending runtime drive)

Branch: `issue-47-location-services`. Issues: **#47** (device-GPS capture /
geolocation) + **#102** (map picker). Single branch, single eventual PR.

Design of record: `docs/adr/0002-location-services-model.md` + `CONTEXT.md`.

## What shipped this session

| Commit    | Scope                                                                        |
| --------- | ---------------------------------------------------------------------------- |
| `7499ccf` | Slice A — one Live fix per submission; removed both per-photo GPS call sites |
| `d12b1a3` | one-fix-per-session test invariant                                           |
| `6f7a0f4` | Prettier on the branch's files                                               |
| `bbbe6d7` | deps: `expo-maps`; declare `xstate` + `@xstate/graph`                        |
| `5765dee` | Slice B — native `expo-maps` map picker (fixed centre pin)                   |
| `c1feef3` | fix — clear coords when the location method changes                          |

Behaviour delivered:

- **One Submission location per submission**, shared by all photos (ADR 0002).
  Stored on `SubmissionDraft` (`latitude`/`longitude`/`accuracy`), sent as
  JSON; no image-byte EXIF writing.
- **Create screen** (`device`): one Live fix on Continue via
  `captureCurrentLocation`; denied/timed-out fix → map picker fallback.
- **Map picker** (`pin`, or GPS-failure fallback): `GoogleMaps.View`, fixed
  centre pin overlay, `onCameraMove` centre → "Set location" commits, Cancel
  returns unchanged. Seed: last-known position → default region.
- Both capture hooks (`usePhotoSession`, `useCameraCapture`) no longer stamp
  per-photo GPS. `useCatSubmit` derives `photo_locations` from the one
  Submission location.
- Switching method clears prior coords so the new method re-acquires (fixes a
  stale-coords bug where a device fix could be submitted as a `pin`).

## Tests

State-machine program-flow model tests only (per the mandated style):

- `CreateScreen.location.model.test.tsx` — device-fix, device-fail→picker,
  pin→picker, one-fix revisit invariant, method-switch re-acquire.
- `LocationPicker.model.test.tsx` — move-and-set vs cancel; the native map SDK
  is mocked.

Gates green: **52 tests**, `tsc` 0, `expo lint` 0 errors, Prettier clean on
branch files.

## Dependencies

- `expo-maps ~56.0.7` added (native module).
- `xstate` + `@xstate/graph` were undeclared on this branch and are now in
  devDependencies (the model tests need them; a fresh install/CI would
  otherwise fail).
- Installs on this repo require `--legacy-peer-deps` (pre-existing
  jest-preset peer conflict, #17).

## Runtime verification — partial

Rebuilt the Android app with `expo-maps` native (`expo prebuild` + gradle) and
confirmed the new native + JS **loads with no crash / no redbox**. The prior
APK (pre-expo-maps) redboxed "Cannot find native module ExpoMaps"; the rebuild
clears that.

**The behavioural drive (create → device → cats; pin → picker) is NOT done.**
It is blocked upstream, not by location code: the auth/consent onboarding path
needed to reach the create screen is not functional on this branch's base
(it loops at onboarding). **Unblock requires `issue-7` (the Firebase auth
migration) to land** — until then there is no runnable base that has both a
working sign-in/consent flow and this location work. Defer the behavioural
drive until after that merges and this branch fast-forwards onto it.

Also note: RN Fabric exposes nothing to `uiautomator` (empty dumps, no
bounds), so driving the UI blind is not possible — the runtime drive needs an
interactive session with eyes on the screen.

## Remaining / deferred (not blockers to committing)

- **Library uploads still tag the device location** (default
  `location_type=device`); the photo-EXIF seed for uploaded photos is
  deferred with the library-upload path.
- **Picker seed order untested** — `getLastKnownPositionAsync` mocked null;
  the last-known branch and Set-without-drag are unexercised.
- **`as Href` cast** in the create screen is removable once expo-router
  regenerates typed routes (the `location-picker` route file now exists) —
  needs a typegen/prebuild pass.
- **Google Maps API key** in `android.config.googleMaps.apiKey` + `expo
prebuild` are still needed to render map tiles on device. Config-only; no
  code change. Slice B renders the pin + buttons without it (blank tiles).
- Leaked autosave `setTimeout` in the create screen ("Jest did not exit")
  — cosmetic; fake-timers later.

## Do not touch

Untracked strays in the working tree — `.firebaserc`, `firebase.json`,
`google-services.json` — are out of scope for this branch. Leave untracked; do
not commit.
