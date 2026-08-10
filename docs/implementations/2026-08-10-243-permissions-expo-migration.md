# Permissions — #243 migrate off react-native-permissions (2026-08-10)

Implements #243. Branch `issue-243-permissions-expo-migration`, off
`origin/main` (`ecf749c`).

## What shipped

Removed `react-native-permissions` entirely. Camera and location permission
status now come from the libraries that actually own that hardware/data
path, closing the drift the issue was filed to prevent:

- **Camera** — `src/hooks/useCameraAccess.ts` now wraps
  `react-native-vision-camera`'s own `useCameraPermission()` hook instead of
  `react-native-permissions`' `check()`/`request()`. This is a deviation from
  the issue's literal ask (`expo-camera`): the app's camera capture already
  runs on `react-native-vision-camera` (`src/hooks/useCameraCapture.tsx`,
  `src/screens/camera/index.tsx`), not `expo-camera`, which isn't even a
  project dependency. Adding `expo-camera` purely as a permission oracle
  would have created a second status source that doesn't gate the actual
  camera hardware — the exact desync #243 exists to fix — and pulled in a
  dependency an already-installed one already covers. `src/screens/consent/index.tsx`
  uses the same package's imperative `VisionCamera.requestCameraPermission()`/
  `VisionCamera.cameraPermissionStatus` (the hook can't be used inside an
  async button handler).
- **Location** — `src/screens/consent/index.tsx` now calls
  `expo-location`'s `requestForegroundPermissionsAsync()`/
  `getForegroundPermissionsAsync()` directly, as the issue asked.
- **Media library** — already fully on `expo-media-library` before this
  change (`src/hooks/useCameraCapture.tsx`); `PERMISSION_MAP.mediaLibrary`
  was dead code (confirmed via grep — no other reference in `src/`).
  `src/lib/permissions.ts` (the whole `PERMISSION_MAP`) is deleted; with
  camera and location both moved off it, nothing referenced it.
- Removed the `react-native-permissions` dependency (`npm uninstall`), its
  `app.json` config-plugin entry, and its `jest.config.js`
  `moduleNameMapper` mock. Its iOS usage-description strings were already
  duplicated directly in `app.json` (`NSCameraUsageDescription` in
  `ios.infoPlist`, `expo-location`'s and `expo-media-library`'s own plugin
  blocks) — removing the plugin needed no replacement config.

## Gate logic — one PR, not split by permission

`isPermissionGated()` (one function, string-status vocabulary shared by
camera and location under `react-native-permissions`) is now two functions,
since camera and location vocabularies diverge under their native libraries:

- `isCameraGated(status)`: gated unless `status === 'authorized'`.
  `react-native-vision-camera`'s `'not-determined'` covers Android's
  first-time "Don't allow" (still askable) — same asymmetry #66/#237 fixed
  under `react-native-permissions`' DENIED-not-BLOCKED-on-first-denial.
  `'restricted'` (e.g. parental controls) gates too.
- `isLocationGated(response)`: gated unless `response.granted` **and**, on
  Android, `response.android?.accuracy === 'fine'`. `expo-location`'s
  `LocationPermissionResponse.android.accuracy` (`'fine' | 'coarse' | 'none'`)
  is what replaces the old Approximate-reads-as-BLOCKED check (#66) —
  Approximate now resolves `granted: true, accuracy: 'coarse'`, which still
  gates. `ios.accuracy === 'reduced'` intentionally does **not** gate,
  matching the old LIMITED status' behavior — reduced iOS access is usable,
  unlike Android's coarse-only grant.

One PR, not split by permission (all three touchpoints are small — 4 source
files — and media-library was already migrated), avoiding the issue's own
warned-against two-vocabularies-at-once state.

## Open questions from the issue, resolved by source read (no device needed)

- **Does `expires` distinguish Android's "Only this time" from "While using
  the app"?** No. `expo-location/android/.../LocationModule.kt` hardcodes
  `expires = "never"` for every Android permission response — not
  conditional on grant type. `expo-modules-core`'s shared
  `PermissionExpiration` doc comment says the same ("Currently, all
  permissions are granted permanently"). #225's notice (already shipped,
  unconditional on every fresh Android grant) is correct as-is and needs no
  further conditioning — this was never verifiable via `expires`.
- **Does `expo-location`'s config plugin add `ACCESS_COARSE_LOCATION`
  unconditionally, relevant to a "Precise only" option?** Yes — hardcoded in
  `expo-location/android/src/main/AndroidManifest.xml`, independent of
  `app.json`'s permission list (which only lists `ACCESS_FINE_LOCATION`).
  Android's manifest merger will always pull in `COARSE` from the native
  module, so the OS will always offer the Precise/Approximate choice — an
  "only offer Precise" config isn't achievable without also suppressing the
  native module's own manifest entry (a bigger native-config change, not
  attempted here). This is why `isLocationGated` checks `accuracy` directly
  rather than trying to prevent Approximate from being offered at all.

## Tests written

Translated the existing three model/flow suites to the new mock vocabulary,
one-for-one — no journeys added or dropped:

- `ConsentScreen.locationGate.model.test.tsx` — `RESULTS.*` → mocked
  `LocationPermissionResponse` objects (`grantedLocation`, `deniedLocation`,
  `approximateLocation` for the old BLOCKED/Approximate case,
  `reducedIosLocation` for the old LIMITED case). The LIMITED-equivalent
  journeys now explicitly set `Platform.OS = 'ios'` for that event, since
  reduced accuracy is a real iOS-only outcome under the new,
  platform-aware gate (the old mock let LIMITED pass through regardless of
  platform since the gate function itself was platform-agnostic).
- `ConsentScreen.cameraGate.model.test.tsx` — `RESULTS.*` → vision-camera's
  `PermissionStatus` strings (`'authorized'`/`'not-determined'`/
  `'denied'`/`'restricted'`).
- `ConsentScreen.test.tsx` — decline flow unaffected; blocked-permission
  recovery and #225 notice tests translated to the same mocked shapes.
- `CameraScreen.permissionGate.model.test.tsx` — unaffected; it mocks
  `useCameraAccess` wholesale, so the hook's internal rewrite is invisible
  to it.

The review pass flagged the three test files' near-identical `jest.mock()`
blocks for `react-native-vision-camera`/`expo-location` as Duplicated Code,
suggesting a root `__mocks__/` file. Left as-is: a root `__mocks__/` manual
mock auto-applies to every suite that imports that module (`location.test.ts`,
`location.model.test.ts`, `LocationPicker.model.test.tsx`, both
`useCameraCapture` suites), which is a bigger blast radius than this scoped
migration should take on, and moving the `jest.mock()` calls into a shared
helper module instead is fragile — `babel-plugin-jest-hoist` only hoists
`jest.mock()` calls written literally in the test file, so correctness would
depend on import-evaluation order a future edit could silently break.

No new test files: `useCameraAccess.ts`'s rewrite delegates to
`react-native-vision-camera`'s own `useCameraPermission()` hook (including
its AppState-foreground recheck), and it has no dedicated test file before
or after this change — `CameraScreen`'s test mocks it entirely, per
`testing.md`'s model-based-tests-only policy (no hand-written per-case
coverage added for a hook that's a thin wrapper over an already-tested
library hook).

## Review fixes

Two robustness fixes made after a Standards/Spec review pass, before
verification below:

- `handleAgree`'s gate check now reads the boolean
  `VisionCamera.requestCameraPermission()` itself resolves with, rather than
  re-reading `VisionCamera.cameraPermissionStatus` right after — not relying
  on the native getter having settled by the time the promise resolves.
  `isCameraGated` (the status-string version) is now used only by the
  foreground-recheck path, where there's no request in flight and the getter
  is the only source of truth.
- `useCameraAccess.ts`'s `openSettings` now wraps `Linking.openSettings()` in
  an arrow function instead of passing the bare method reference — matches
  `ConsentScreen`'s existing `() => Linking.openSettings()` call and avoids a
  detached-`this` risk neither Jest nor `tsc` would catch.

## Deviation from the issue's literal ask

The issue named `expo-camera` as camera's migration target. This diff moves
camera permission handling to `react-native-vision-camera`'s own
`useCameraPermission()`/`VisionCamera` API instead — the app's camera capture
already runs on `vision-camera` (`useCameraCapture.tsx`,
`screens/camera/index.tsx`); `expo-camera` isn't and wasn't a project
dependency. Adding it purely as a permission oracle would have created a
second status source that doesn't gate the actual camera hardware — the
exact drift #243 exists to fix. Flagged back to the user directly (not just
in this note) since it reverses a same-day named decision in the issue.

## Verification status

`npx tsc --noEmit` clean. `npx jest` — 49 suites / 201 tests, all pass.
`npx expo lint` — 0 errors (30 pre-existing `require()`-in-tests warnings,
none in touched files). `npx prettier --check` clean on all touched files.

**Not run on-device** — no physical device/emulator in this environment.
The gate logic itself is JS-only status branching (same class of change as
#66/#237, which were also verified this way), but the _native_ permission
plumbing this migration changes (vision-camera's Nitro-backed camera
permission calls, expo-location's Android accuracy field) has not been
exercised against a real OS permission dialog. Recommend a device sweep
before shipping, specifically: camera first-denial → `'not-determined'`
gates; Approximate location grant → `android.accuracy === 'coarse'` gates;
full grant proceeds; Settings-recovery clears both gates.
