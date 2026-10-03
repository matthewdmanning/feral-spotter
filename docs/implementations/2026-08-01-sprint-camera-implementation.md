# Sprint:camera implementation notes (2026-08-01)

Implements the build spec in `docs/planning/2026-07-31-sprint-camera-planning.md`
(#121 umbrella → #122, #105, #104, #123) on branch
`issue-128-location-capture-timing`. Code complete; **not yet run on a
device/emulator** — see Verification status below before merging.

## What shipped

**#122 — Settings button removed** from Home header (`src/screens/home/index.tsx`).
The Settings tab itself is untouched.

**#105 + #104 — Two-button entrypoint, library picker, time model**

- Home screen's round camera button replaced with two equal-size stacked
  `AppButton`s: "Take a Photo" (camera, top) / "Choose from Library"
  (bottom). Multi-select on for the library pick.
- New `src/hooks/useLibraryPhotoPicker.ts`: `launchImageLibraryAsync`,
  builds `SubmissionPhoto`s via extracted `src/utils/buildSubmissionPhoto.ts`,
  adds straight to `usePhotoStore` (no staging screen), forces
  `location_type: 'pin'` on first pick, classifies time per ADR 0003.
- New `src/utils/libraryPickTime.ts`: `parseExifDateTime` (EXIF
  `"YYYY:MM:DD HH:MM:SS"` → ISO, rejects zeroed-clock/malformed) and
  `classifyLibraryPickTime` (all-EXIF-present → earliest wins; any missing →
  whole batch falls back to `'manual'`).
- `captured_at` threaded through `useSubmissionStore` (`SubmissionDraft` +
  `setCapturedAt`), `SubmissionApiPayload.submission`, and
  `CacheMetadata` — reaches the API payload for free since `useSubmissionSubmit`
  already spreads the whole `submission` object in.
- **Photo-source-exclusivity gate**: `usePhotoStore` gained a `source:
'camera' | 'library' | null` field. `addPhoto` (camera's only call site)
  pins `'camera'`; `addPhotos` (library's only call site) pins `'library'`;
  `removePhoto` clears it back to `null` only once the pool is actually
  empty (post-filter length, not pre-filter — fixed after an advisor-caught
  off-by-one during review). Home screen disables whichever button doesn't
  match the current `source`. This is the code-level enforcement of ADR
  0002's "a draft is single-source by construction" amendment — not in the
  original build-spec file list, but required to actually implement it,
  since neither `location_type` nor pool-length alone can tell you which
  source is already in use (a GPS-denied _camera_ draft can also end up
  `location_type: 'pin'`).
- **#94 closed as a side effect**: `DateTimePickerButton` gets its first
  real call site (`create/index.tsx`'s new Date & Time warning row) with
  `maximumDate={new Date()}` wired in.
- **#91 fix**: `consent/index.tsx` no longer eagerly requests
  `mediaLibrary` in `handleAgree` (camera + location requests unchanged).
- Dead flow deleted: `usePhotoSession.ts`, `screens/submission/photos/`,
  `app/submission/photos.tsx`, `'photos'` removed from `_layout.tsx`'s
  `STEPS`. `sessionPhotos`/`addSessionPhoto`/`removeSessionPhoto` stripped
  from `useUIStore` and their call sites in `useCameraCapture.tsx` (dead
  writes — `PhotosScreen` was the only reader).

**#123 — Swipe-up-to-remove** (`CameraThumb.tsx`): tap-X `Pressable`
replaced with a directional-locked `Gesture.Pan()` (`activeOffsetY`/
`failOffsetX`, same idiom as `useBoundingBoxFrame.ts`), driving
`translateY`/opacity via Reanimated, calling `onRemove` past a 60px
upward-swipe threshold. `accessibilityAction` ("Discard photo") kept as
the non-gesture screen-reader path.

## Regression caught and fixed mid-implementation

Removing consent's eager `mediaLibrary` request (#91) would have silently
broken the camera's keep-on-device gallery save: `useCameraCapture.tsx`
only ever `check()`ed that permission, never requested it, so a fresh
install would get `denied` and the `Asset.create` save would no-op with no
user-visible error. Fixed by requesting it lazily, at the point of use,
right before the save — same pattern as the library picker's own lazy
prompt.

## xstate model

New `src/screens/home/__tests__/HomeScreen.photoSourceGate.model.test.tsx`,
kept **separate** from the existing `HomeScreen.gate.model.test.tsx`
(auth/consent gate) per advisor guidance — the two gates are orthogonal and
cross-producting them into one machine would explode the state count for no
benefit. Three states (`emptyPool` / `cameraDraft` / `libraryDraft`), four
journeys via `getPathsFromEvents`.

`usePhotoStore` is **mocked** in this model test (a controlled `source`
value), not driven live — the real persisted store's async-storage
rehydration was found to corrupt `react-test-renderer` mid-suite in this
RN 0.85.3 / React 19.2.3 / `@testing-library/react-native` 13.3.3
combination (reproduced in isolation: same crash occurs on a bare
`render(<HomeScreen />)` the moment the real `usePhotoStore` import is
used instead of a mock, independent of any interaction with it — an
environment issue, not a logic bug). The store's own reducer logic that the
gate depends on (`addPhoto`/`addPhotos` pinning `source`, `removePhoto`
clearing it at the last photo) is covered separately in
`usePhotoStore.source.test.ts`, which does no rendering and so isn't
exposed to that renderer bug.

## Tests written (each purpose advisor-approved before writing)

| File                                                                   | Purpose                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/__tests__/libraryPickTime.test.ts`                          | `parseExifDateTime`: EXIF's `"YYYY:MM:DD HH:MM:SS"` isn't `new Date()`-parseable — this was the single highest-value test (advisor's term: "the landmine"). Covers valid, zeroed-clock, malformed/undefined. `classifyLibraryPickTime`: earliest-wins (out-of-order input, to prove it's not just `[0]`), any-missing→manual, single-present, single-missing. |
| `src/hooks/__tests__/usePhotoStore.source.test.ts`                     | Pure reducer test for the source-pinning logic the gate is built on, including the last-photo clear edge.                                                                                                                                                                                                                                                     |
| `src/screens/home/__tests__/HomeScreen.photoSourceGate.model.test.tsx` | xstate model of the exclusivity gate across all three states and both clear-paths (manual removal, submit/reset).                                                                                                                                                                                                                                             |

**Dropped after advisor review:** a `captured_at` cache-round-trip test —
confirmed the resume path reads from the persisted `useSubmissionStore`
(which already carries `captured_at`), not from `submissionCache`
(display-only, used for the Feral Reports list). A dropped cache field
breaks nothing user-facing, so it failed the "important" bar.

**Rejected as no clean unit seam:** swipe-gesture/accessibility-action
(`GestureDetector`/worklet — integration-level, not unit logic) and the
`#94` `maximumDate` bound (enforced by the native `RNDateTimePicker`
itself; `useDateTimePicker.handleConfirm` applies no bound of its own, so
there's no logic to assert against).

## Verification status

Gates run and passing: `tsc --noEmit` (both `tsconfig.json` and
`tsconfig.server.json`), full `jest` suite (23 suites / 82 tests), `expo
lint` (0 errors, pre-existing require()-in-tests warnings only).

**Not run on an emulator/device.** Before merging, at minimum check:

- Swipe-up-to-remove — the build spec itself flags a possible conflict
  with the Android system home/back edge gesture on a bottom-of-screen
  thumbnail strip; this needs a real on-device pass, not just a direction
  check.
- Library picker end-to-end: picker actually launches, lazy permission
  prompt appears once, picked photos land in the pool, navigation to
  `/submission/create` happens.
- The new mid-capture `mediaLibrary` permission prompt (first shutter
  press behaves differently now than before this change).
- Date & Time warning row: single tap should open the picker modal
  directly (no intermediate state); visually it's an `AlertCircle` +
  `Calendar`-icon-and-value pair, not a pixel-match of the location
  warning's static-icon-plus-label row — worth a look before considering
  it a full visual parity with location.
- Source-gate button disabling was verified only against a mocked
  `source` value, not the live store end-to-end through actual button
  presses.

## Known pre-existing pattern, not changed here

`useLibraryPhotoPicker.ts` uses `ImagePicker.MediaTypeOptions.Images`,
carried over unchanged from the deleted `usePhotoSession.ts`. This enum is
deprecated in recent `expo-image-picker` versions (string-array
`mediaTypes: ['images']` is the replacement) but still present and
type-checks in this project's installed SDK — flagging since this is now a
live path, not touching it since it's an existing codebase convention, out
of scope for this sprint.

## 2026-08-09 — fix

**Purpose:** #228 — found while auditing #224 (Library Pick Manual-time
fallback, untested/needs-fixture). The local submission cache
(`databases/RKStorage`, `submission_cache_<uuid>`) never picked up
`manual_time`/`time_type` set after the cache's initial creation, because
`createSubmissionCache` snapshots `metadata` once on mount — before the
user has touched the manual date-time picker on an EXIF-less Library
pick — and `updateSubmissionCache`'s `metadata` field replaces wholesale
(no deep merge), so nothing later re-synced it.

**Change:** `useSubmissionSubmit.ts`'s `handleDone` now resends the full
current `metadata` snapshot (`location_method`, `time_method`, `address`,
`manual_time`, `captured_at`) in its `updateSubmissionCache` call at
submit. The live API payload was already correct (built from the
zustand store directly) — this only fixes the cached copy, which feeds
`SUBMISSION_SENDING`/`SUBMITTED`/`FAILED` and `REPORTS_VIEWED` analytics
events. Resume Submission is unaffected (reads the live store, not this
cache).

Test: `src/hooks/__tests__/useSubmissionSubmit.cacheSync.test.ts` — sets
`time_type: 'manual'` + `manual_time`, drives `handleDone`, asserts
`updateSubmissionCache` is called with that metadata.

Verification: `npx jest src/hooks/__tests__/useSubmissionSubmit` (2/2
pass), `npx tsc --noEmit` clean, `npx eslint` clean on touched files (one
pre-existing `no-require-imports` warning, same pattern as the sibling
reset test). Not device-tested (no physical device in this environment).

## 2026-09-28 — refactor

**Purpose:** The Stage 1 (issue #385), Stage 2 (performance) and Stage 3
(maintainability) reviews of the camera seam on `feat-camera-capture-stack`
found that the two capture hooks and the two camera screens each held their own
copy of the application workflow around a capture. The copies had already
drifted. This entry covers the React Native layer's half of the seam; the
Android, iOS and continuous-integration halves are separate work.

**Change:** `useCapturedPhotoWorkflow` now owns the application workflow for
both backends — captured photo state, the upload and gallery-save flow, screen
chrome state and navigation — and `CameraChrome` owns the shared screen chrome.
`useCameraCapture` and `useNativeCameraCapture` keep only what is specific to
their backend, plus their own telemetry, because the two paths still emit
different event vocabularies.

Findings closed:

| Review  | Finding    | Fix                                                                                                                                                                                    |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stage 1 | 3, JS half | `buildSubmissionPhotoFromCapture` rejects zero dimensions instead of uploading a 0x0 photo. Kotlin still reads `resolutionInfo` before `takePicture`; that fix is in the Android work. |
| Stage 1 | 4          | `captured_at` is always the JS shutter stamp. `capturedAt` is gone from `NativeCapturedPhoto`. Swift still sends it; removing that is in the iOS work.                                 |
| Stage 2 | 1          | Gallery writes are collected during a capture sequence and flushed once after it, instead of awaiting MediaLibrary inside the burst loop.                                              |
| Stage 2 | 2          | `deleteCapturedPhotoFile`, called from the photo store's `removePhoto` and `clearPhotos`. The upload cannot own this: `photo.uri` is what the annotate carousel renders from.          |
| Stage 2 | 4          | `renderItem` no longer depends on the photo count, so it is not recreated per captured frame. Upload progress writes are throttled to one per 250ms per photo.                         |
| Stage 2 | 5          | Uploads run two at a time through a queue in `uploadNewPhoto`.                                                                                                                         |
| Stage 2 | 8          | `handleTakePhoto` reads `isTakingPhoto` from a ref in both hooks.                                                                                                                      |
| Stage 2 | 11         | `isNativeIdentificationCameraAvailable` resolves once.                                                                                                                                 |
| Stage 2 | 12         | Dropped the `useMemo` around `getNativeView`, which already caches.                                                                                                                    |
| Stage 3 | 1.2        | `useCapturedPhotoWorkflow`.                                                                                                                                                            |
| Stage 3 | 1.3        | `CameraChrome`.                                                                                                                                                                        |
| Stage 3 | 4          | `pipeline.ts` records that `ImagePostprocessor` and `SubjectLocalizer` are deliberate seams.                                                                                           |
| Stage 3 | 5          | `style?: StyleProp<ViewStyle>` instead of `unknown`.                                                                                                                                   |

Tests written:

- `src/utils/__tests__/buildSubmissionPhotoFromCapture.contract.test.ts` — the
  shared photo contract, asserted against the payload each backend really
  returns. Eight cases: three accepted payloads, four rejected, and one that
  proves `captured_at` comes from the shutter and never from the backend.
- `src/lib/camera/__tests__/capturedPhotoFiles.test.ts` — cleanup deletes only
  inside the cache directory, so a library-picked photo outside it survives.
- `src/lib/upload/__tests__/uploadNewPhoto.queue.test.ts` — a six-frame burst
  never exceeds two concurrent uploads and the queue always drains. Confirmed
  load-bearing: it fails when the cap is lifted.
- `src/hooks/__tests__/useCameraCapture.test.ts` — added an assertion that each
  captured photo reaches the uploader.

Caught along the way, outside the reviews' scope: the legacy hook's test mock
never provided `usePhotoStore.getState`, so every capture test had been landing
in the failure branch while still passing its assertions. The upload hand-off
was therefore untested. Fixed, and asserted.

**Verification:** `npx tsc --noEmit` clean. `npx jest` 67 suites / 315 tests
pass. `npx eslint` clean on every touched file; the one remaining error in the
repo is pre-existing (`__dirname` in `eslint.config.js`, which the lint script
does not target). Not device-tested and not emulator-tested — this needs an
Android test drive before it is trusted, and no iOS device is available at all.

---

## 2026-09-28 — Android compile, and the iOS camera seam

Branch `feat-ios-camera-setup`, stacked on `feat-android-camera-setup`.

### Android: first compile

`./gradlew :native-identification-camera:compileDebugKotlin` succeeded on the
first run. The roughly 300 lines of Kotlin written in the previous session
compile as written. This is a compile result only. The emulator drive listed in
the Android handoff has not run, so the Android work is still **needs test
drive**.

### iOS: what changed

No iOS device, no simulator and no macOS runner are available, and no Swift
toolchain is installed on this machine. Nothing below was compiled. Every item
is **needs test drive**, not fixed.

| Review  | Finding          | Fix                                                                                                                                                                                                                                                                                                                                                                             |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stage 3 | 1.1, duplication | The exposure-cap heuristic had a copy in each iOS module. One copy now, `modules/native-identification-camera/ios/CameraExposurePolicy.swift`, with the comment it never had: why the cap exists, how the value is picked, and why a duration is clamped to the active format. `IosCameraOptimizer.podspec` takes a pod dependency on `NativeIdentificationCamera` to reach it. |
| Stage 1 | 1, blocker       | `AVCaptureDevice` is shared per process, so the view's format, exposure cap, low-light and zoom settings outlived the view and applied to the VisionCamera path. `SavedDeviceState` records the device as found; `restoreDeviceState` puts it back on a position flip and on view teardown.                                                                                     |
| Stage 1 | 2, blocker       | `photoOutput(_:didFinishCaptureFor:error:)` is implemented, and both delegate callbacks route through `settle`, which fires the promise exactly once. Stopping the session also settles anything still in flight, so an interrupted capture no longer leaves the shutter disabled.                                                                                              |
| Stage 2 | 6                | Mount configured the session twice: once from `init`, once when the `position` prop arrived. `init` no longer configures.                                                                                                                                                                                                                                                       |
| Stage 2 | 7                | Prop setters record a pending flag; `OnViewDidUpdateProps` applies one configuration per prop batch. Three settings changing together now cost one cycle, not three.                                                                                                                                                                                                            |
| Stage 2 | 9                | The per-photo `ISO8601DateFormatter` is gone, along with the field it fed.                                                                                                                                                                                                                                                                                                      |
| Stage 1 | 4, Swift half    | `capturedAt` removed from the Swift capture result. The contract is now what `types.ts` declares.                                                                                                                                                                                                                                                                               |
| —       | Telemetry parity | `CaptureTuning.swift` mirrors the Android table's shape, not its policy. `onCameraReady` carries `captureTuning` and `captureMode`, so a profiling run reads the same field on both platforms.                                                                                                                                                                                  |
| Stage 3 | 4                | Rationale comments on every non-obvious capture setting: why `.photo`, why continuous focus and exposure, why low-light boost is refusable, why `.invalid` rather than zero, and why device types are tried widest first.                                                                                                                                                       |

### Correction to the iOS handoff

The handoff said to restore device state on "the Expo view teardown hook".
There is no Expo _lifecycle_ hook for it: `ViewLifecycleMethodType` has exactly
one case, `didUpdateProps`, and `OnViewDestroys` is Android-only. `deinit` does
not run while JavaScript still holds the ref, so it is a backstop, not the
mechanism.

The corresponding function is `prepareForRecycle`, which Fabric calls when it
unmounts a component view. `ExpoFabricViewObjC.h:65` re-declares it in the
Swift-visible interface under "Derived from `RCTComponentViewProtocol`", so an
`ExpoView` subclass can override it; `RCTViewComponentView.h:76` marks it
`NS_REQUIRES_SUPER`.

`didMoveToWindow` was the first answer here and it was the wrong one: it also
fires on transient detaches, so it would restore the device and re-apply the
policy repeatedly. `prepareForRecycle` also makes the recycling explicit —
Fabric reuses the instance, so teardown clears the session state and sets
`needsSessionConfiguration`, and the next prop batch configures from scratch.

### Left open

- `(maxDetail: true, motionPriority: true)` still resolves to `.balanced` here
  and to zero-shutter-lag on Android. The disagreement is deliberate and
  reported in telemetry; resolving it needs the profiling run.
- The vocabulary and configuration sweep, and the native-code CI split, are
  separate features and are not started.
