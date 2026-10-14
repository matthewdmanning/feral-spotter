# Branch diffs: camera dev branches

Temporary working file. Not for commit. Findings only. No recommendations.

Date of observation: 2026-10-04. Repo: `C:\GitHub\feral-spotter`. `main` = `origin/main` = `a0bb3e5`.

## 1. Branches examined

| Branch                                                     | Tip       | Commits vs `main` (`main..branch`) | Behind `main` | `docs/` in tip                |
| ---------------------------------------------------------- | --------- | ---------------------------------- | ------------- | ----------------------------- |
| `main`                                                     | `a0bb3e5` | -                                  | -             | normal tree (`b0ad196`)       |
| `dev/camera-parent-ready`                                  | `4b0e189` | 4                                  | 159           | submodule gitlink (`7b890df`) |
| `dev/camera-ios-ready`                                     | `c4939aa` | 3                                  | 0             | normal tree (`b0ad196`)       |
| `dev/camera-ios-fixes-checkpoint`                          | `8dd9a9c` | 2                                  | 170           | submodule gitlink (`7b890df`) |
| `dev/camera-ios-checkpoint` (also `feat-ios-camera-setup`) | `89f5912` | 1                                  | 176           | submodule gitlink (`27ab001`) |

- `dev/camera-ios-fixes` does not exist locally or on `origin` (checked: local refs, reflog, worktrees, `git ls-remote`).
- Nothing in the branches above is pushed to `origin`. `git ls-remote --heads origin 'dev/*'` returned nothing.
- Worktrees: `dev/camera-parent-ready` is at `C:/Users/mattm/.codex/worktrees/camera-release/feral-spotter`. `dev/camera-ios-ready` is at `.../camera-ios/feral-spotter`. `dev/camera-android-ready` is at `.../camera-android/feral-spotter`.
- `main` has `docs/` as a normal folder since PR #391 (`4d47b71`).

## 2. Commits unique to each branch (`main..branch`)

| Branch                            | Commit    | Date       | Subject                                                                                         |
| --------------------------------- | --------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `dev/camera-parent-ready`         | `4b0e189` | 2026-10-02 | fix(camera): enable native capture and independent tap focus                                    |
|                                   | `3b01e80` | 2026-10-02 | chore(camera): reconcile parent with merged Android baseline                                    |
|                                   | `07e212f` | 2026-10-02 | fix(camera): retain gallery files and render current photo counts                               |
|                                   | `4c1bd9f` | 2026-10-02 | chore(camera): reconcile shared workflow with main (merge commit)                               |
| `dev/camera-ios-ready`            | `c4939aa` | 2026-10-02 | fix(camera): preserve iOS session state and honor pinch settings                                |
|                                   | `7f758cc` | 2026-10-02 | fix(camera): enable native capture and independent tap focus                                    |
|                                   | `2ddf7ef` | 2026-10-02 | fix(camera): retain gallery files and render current photo counts                               |
| `dev/camera-ios-fixes-checkpoint` | `8dd9a9c` | 2026-10-02 | fix(camera): preserve iOS session state and honor pinch settings                                |
|                                   | `4c1bd9f` | 2026-10-02 | chore(camera): reconcile shared workflow with main (merge commit; parents `4b1eeb9`, `3f6bb2c`) |
| `dev/camera-ios-checkpoint`       | `89f5912` | 2026-09-28 | feat(camera): ios camera session setup                                                          |

- `4b0e189` and `7f758cc` have the same subject. `07e212f` and `2ddf7ef` have the same subject. They have different hashes.
- `8dd9a9c` and `c4939aa` have the same subject. They have different hashes.
- `git cherry dev/camera-ios-ready dev/camera-ios-fixes-checkpoint` marks `8dd9a9c` as `+` (no patch-equivalent on `ios-ready`). `git cherry` does not list `4c1bd9f` (merge commits are skipped).
- `git cherry dev/camera-ios-ready dev/camera-ios-checkpoint` marks `89f5912` as `+`.
- Commit bodies of `8dd9a9c`, `4c1bd9f`, `c4939aa`, `7f758cc`, `2ddf7ef`, `4b0e189`, `3b01e80`, `07e212f` are empty. Only the subject line exists.

## 3. Relations between branches

| Pair                                                                             | Result                                                                                          |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `main` is ancestor of `dev/camera-ios-ready`                                     | yes (`main` can fast-forward to it)                                                             |
| `main` is ancestor of `dev/camera-parent-ready`                                  | no. Merge-base `453bc4f`.                                                                       |
| `main` is ancestor of `dev/camera-ios-fixes-checkpoint`                          | no. Merge-base `3f6bb2c`.                                                                       |
| `main` is ancestor of `dev/camera-ios-checkpoint`                                | no. Merge-base `04af5ad`.                                                                       |
| `parent-ready` vs `ios-ready`                                                    | diverged: 4 only on parent, 162 only on `ios-ready`                                             |
| `parent-ready` vs `ios-fixes-checkpoint`                                         | diverged: 14 only on parent, 1 only on the checkpoint                                           |
| `ios-checkpoint` vs `ios-fixes-checkpoint`                                       | diverged: 2 only on `ios-checkpoint`, 9 only on `ios-fixes-checkpoint`                          |
| `1451e10` (fix(camera): make the native camera work on a device) is ancestor of: | `main` yes, `ios-ready` yes, `parent-ready` yes, `ios-fixes-checkpoint` no, `ios-checkpoint` no |

- `git diff --stat main...dev/camera-ios-fixes-checkpoint` warns "multiple merge bases" and reports 42 files, 3634 insertions. That figure is not the branch's own change. Use `main..branch` commit lists instead.

## 4. Changes by branch (own changes vs `main`)

### 4.1 `dev/camera-parent-ready` (`git diff --stat main...dev/camera-parent-ready`, 9 files, +421 −31)

- `src/hooks/useCapturedPhotoWorkflow.tsx` (38 lines changed)
- `src/hooks/__tests__/useCapturedPhotoWorkflow.test.tsx` (+204)
- `src/lib/camera/capturedPhotoFiles.ts` (+67) and `src/lib/camera/__tests__/capturedPhotoFiles.test.ts` (30)
- `src/hooks/useNativeCameraCapture.tsx` (+6)
- `src/hooks/__tests__/useNativeCameraCapture.focus.test.ts` (+58)
- `src/hooks/useSettingsStore.ts` (1 line) and `src/hooks/__tests__/useSettingsStore.nativeDefault.test.ts` (+37)
- `src/screens/camera/NativeCameraScreen.tsx` (10 lines)
- No Swift or Kotlin files change.
- `NativeIdentificationCameraView.swift` on this branch equals `main`: `pinchZoom` at lines 118-124, `pinchRecognizer` at 127 and 137-138. No `SavedDeviceState`, `restoreDeviceState`, `settle` or `OnViewDidUpdateProps` match.
- `NativeIdentificationCameraModule.swift:58-59` has `Prop("pinchZoom")`.
- Only `docs/` differs in kind from `main` (submodule pointer, not a tree).

### 4.2 `dev/camera-ios-ready` (`git diff --stat main...dev/camera-ios-ready`, 15 files, +835 −148)

Same 9 TypeScript files as `parent-ready` (same line counts), plus 6 iOS files from `c4939aa`:

| File                                                                              | Change                                                                                                                       |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `modules/ios-camera-optimizer/ios/IosCameraOptimizer.podspec`                     | +2 (line 15 comment and `NativeIdentificationCamera` dependency)                                                             |
| `modules/ios-camera-optimizer/ios/IosCameraOptimizerModule.swift`                 | 44 lines changed. Line 35 now calls `CameraExposurePolicy.motionPreservingExposureCap`. Local copy of the heuristic removed. |
| `modules/native-identification-camera/ios/CameraExposurePolicy.swift`             | new, 73 lines. `public enum CameraExposurePolicy` at line 35.                                                                |
| `modules/native-identification-camera/ios/CaptureTuning.swift`                    | new, 83 lines                                                                                                                |
| `modules/native-identification-camera/ios/NativeIdentificationCameraModule.swift` | +7. `OnViewDidUpdateProps` at line 41. `Prop("pinchZoom")` at lines 65-66.                                                   |
| `modules/native-identification-camera/ios/NativeIdentificationCameraView.swift`   | 322 lines changed (see 4.5 for line numbers)                                                                                 |

- Commit `7f758cc` = same file set as `4b0e189` on `parent-ready`. Commit `2ddf7ef` = same file set as `07e212f`.

### 4.3 `dev/camera-ios-fixes-checkpoint`

- `8dd9a9c` touches the same 6 iOS files as `c4939aa`: podspec +2, `IosCameraOptimizerModule.swift` 44, `CameraExposurePolicy.swift` +73, `CaptureTuning.swift` +83, `NativeIdentificationCameraModule.swift` +11, `NativeIdentificationCameraView.swift` 341 lines changed (434 insertions, 120 deletions in total).
- `c4939aa` totals are 414 insertions, 117 deletions.
- The extra lines in `8dd9a9c`'s patch (`Prop("pinchZoom")` and the `pinchZoom` property) add code that already exists on `main` (added by `1451e10`). The `8dd9a9c` patch therefore re-adds those lines relative to its own older base.

### 4.4 `dev/camera-ios-checkpoint` (`89f5912`, 2026-09-28)

Commit body (summary):

- "Nothing here was compiled: no iOS device, no simulator, no macOS runner and no local Swift toolchain. Every change is eyes-only and needs a test drive."
- Restore shared device state (`SavedDeviceState`, `restoreDeviceState`), on a position flip and on teardown.
- Settle the capture promise once (`settle`). Stopping the session settles anything in flight.
- Configure the session once per mount and once per prop batch (`OnViewDidUpdateProps`).
- Move the exposure-cap heuristic into `CameraExposurePolicy`. Drop `capturedAt` and its date formatter. Add `CaptureTuning.swift`.

Code locations on this branch:

- `NativeIdentificationCameraView.swift`: `settle` line 32, `SavedDeviceState` line 104, `savedDeviceStates` line 135, comment on `OnViewDidUpdateProps` line 142, `restoreDeviceState` calls at lines 268 and 488 and 692, definition at 428, `CameraExposurePolicy` use at 397, `settleAllPendingCaptures` at 557.
- `NativeIdentificationCameraModule.swift:41` `OnViewDidUpdateProps`.
- `CameraExposurePolicy.swift:35`.
- No `pinchZoom` or `pinchRecognizer` match anywhere in the iOS folder (base predates `1451e10`).

### 4.5 Line numbers of the same markers in the three tips

All paths under `modules/native-identification-camera/ios/NativeIdentificationCameraView.swift` unless stated.

| Marker                                             | `ios-checkpoint` | `ios-fixes-checkpoint` | `ios-ready` | `main` / `parent-ready` |
| -------------------------------------------------- | ---------------- | ---------------------- | ----------- | ----------------------- |
| `func settle`                                      | 32               | 32                     | 32          | none                    |
| `struct SavedDeviceState`                          | 104              | 104                    | 104         | none                    |
| `savedDeviceStates`                                | 135              | 135                    | 135         | none                    |
| `OnViewDidUpdateProps` comment                     | 142              | 142                    | 142         | none                    |
| pinch comment block starts                         | none             | 189                    | 189         | 118                     |
| `var pinchZoom`                                    | none             | 193                    | 194         | 123                     |
| `didSet { pinchRecognizer.isEnabled ...}`          | none             | 194                    | 195         | 124                     |
| `lazy var pinchRecognizer`                         | none             | 197                    | 198         | 127                     |
| `pinchRecognizer.isEnabled = pinchZoom` (init)     | none             | 211                    | 212         | 137                     |
| `addGestureRecognizer(pinchRecognizer)`            | none             | 212                    | 213         | 138                     |
| `restoreDeviceState(for: currentInput.device)`     | 268              | 281                    | 282         | none                    |
| `CameraExposurePolicy.motionPreservingExposureCap` | 397              | 410                    | 411         | none                    |
| `savedDeviceStates[...] = SavedDeviceState(`       | 412              | 425                    | 426         | none                    |
| `func restoreDeviceState`                          | 428              | 441                    | 442         | none                    |
| `self.restoreDeviceState(for: device)`             | 488              | 501                    | 502         | none                    |
| `func settleAllPendingCaptures`                    | 557              | 570                    | 571         | none                    |
| `restoreDeviceState(for: device)` (teardown)       | 692              | 705                    | 706         | none                    |

`NativeIdentificationCameraModule.swift`: `Prop("pinchZoom")` at lines 65-66 on `ios-fixes-checkpoint` and `ios-ready`, at lines 58-59 on `main` and `parent-ready`, absent on `ios-checkpoint`.

## 5. Direct tree comparisons

### 5.1 `dev/camera-ios-fixes-checkpoint` vs `dev/camera-ios-ready` (`git diff --stat modules/`, 6 files, +515 −72)

iOS folder (the only iOS difference):

- `NativeIdentificationCameraView.swift` hunk `@@ -189,4 +189,3 @@`. Comment text only.
  - `ios-ready` (lines 189-192): "Pinch to zoom. Off by default, matching Android: a zoomed capture is a cropped capture, and an identification photograph is worth more at full sensor width. The recognizer stays installed and is enabled or disabled, because adding and removing it would race the gesture it is recognizing."
  - `ios-fixes-checkpoint` (lines 189-191): "Pinch to zoom is opt-in, matching the shared camera setting. The recognizer stays installed and only changes enabled state so prop updates cannot race gesture recognition."
  - Code on lines 193-195 / 194-196 is the same.

Non-iOS files (present on `ios-ready`, absent or older on `ios-fixes-checkpoint`):

- `modules/native-identification-camera/android/.../CaptureTuning.kt` (+78)
- `modules/native-identification-camera/android/.../NativeIdentificationCameraModule.kt` (17 lines)
- `modules/native-identification-camera/android/.../NativeIdentificationCameraView.kt` (450 lines)
- `modules/native-identification-camera/index.ts` (+2, hunk at line 5)
- `modules/native-identification-camera/src/types.ts` (+21 at lines 17-37, 11 lines at 62-72)

### 5.2 `dev/camera-ios-checkpoint` vs `dev/camera-ios-ready` (iOS folder, diff from `ios-checkpoint` to `ios-ready`: 2 files, +21 −3)

- `NativeIdentificationCameraModule.swift`: `ios-ready` has 4 lines at 65-68 (`Prop("pinchZoom")`) that `ios-checkpoint` lacks.
- `NativeIdentificationCameraView.swift`: two hunks.
  - `@@ -188,15 +187,0 @@`: `ios-ready` has 15 lines at 188-202 (pinch comment, `pinchZoom`, `pinchRecognizer`) that `ios-checkpoint` lacks.
  - `@@ -212,2 +197,3 @@`: `ios-ready` lines 212-213 (`pinchRecognizer.isEnabled = pinchZoom`, `addGestureRecognizer(pinchRecognizer)`) replace `ios-checkpoint` lines 197-199, where `init` adds an inline `UIPinchGestureRecognizer` through `addGestureRecognizer`.
- `CameraExposurePolicy.swift` and `CaptureTuning.swift` are byte-identical on both branches.
- `modules/ios-camera-optimizer` shows no diff between the two.

## 6. Observed facts, stated plainly

- `ios-ready`, `ios-fixes-checkpoint` and `ios-checkpoint` carry the same iOS design work: `SavedDeviceState`, `settle`, once-per-prop-batch configuration, `CameraExposurePolicy`, `CaptureTuning`.
- The three differ in iOS code only in the pinch-zoom lines (present on `ios-ready` and `ios-fixes-checkpoint`, absent on `ios-checkpoint`) and in one comment block.
- `pinchZoom` is on `main` (from `1451e10`). It is not new in `c4939aa` or `8dd9a9c`.
- `parent-ready` has the TypeScript changes from `ios-ready` and none of the Swift changes.
- `ios-ready` is the only one of the four branches whose base is the current `main`.
- No branch here was compiled or run on iOS, per the `89f5912` commit message. No later commit message states otherwise (later commit bodies are empty).

## 7. Corrections to earlier statements in this session

- Earlier claim: "`ios-ready` lacks the pinch-zoom prop that `8dd9a9c` adds." Wrong. `ios-ready` and `main` have it (`1451e10`). The `8dd9a9c` patch looked different only because of its older base.
- Earlier claim: "`parent-ready` is 4 ahead, 159 behind `main`." Confirmed by `git rev-list --left-right --count main...dev/camera-parent-ready` (159, 4).
- Earlier claim: "`dev/camera-ios-fixes-checkpoint` has 1 unique commit." Wrong. It has 2 (`8dd9a9c`, `4c1bd9f`). The earlier "1" was the count against `parent-ready`.
