# Sprint:camera implementation notes (2026-08-01)

Implements the build spec in `docs/design/2026-07-31-sprint-camera-planning.md`
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
  source is already in use (a GPS-denied *camera* draft can also end up
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

| File | Purpose |
|---|---|
| `src/utils/__tests__/libraryPickTime.test.ts` | `parseExifDateTime`: EXIF's `"YYYY:MM:DD HH:MM:SS"` isn't `new Date()`-parseable — this was the single highest-value test (advisor's term: "the landmine"). Covers valid, zeroed-clock, malformed/undefined. `classifyLibraryPickTime`: earliest-wins (out-of-order input, to prove it's not just `[0]`), any-missing→manual, single-present, single-missing. |
| `src/hooks/__tests__/usePhotoStore.source.test.ts` | Pure reducer test for the source-pinning logic the gate is built on, including the last-photo clear edge. |
| `src/screens/home/__tests__/HomeScreen.photoSourceGate.model.test.tsx` | xstate model of the exclusivity gate across all three states and both clear-paths (manual removal, submit/reset). |

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
