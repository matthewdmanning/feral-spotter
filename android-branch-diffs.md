# Branch diffs: Android camera dev branches

Temporary working file. Not for commit. Findings only. No recommendations.

Date of observation: 2026-10-04. Repo: `C:\GitHub\feral-spotter`. `main` = `origin/main` = `a0bb3e5`.
Companion file: `os-branch-diffs.md` (iOS branches).

## 1. Branches examined

| Branch                                | Tip       | Own commits (`main..branch`) | Ahead / behind `main` | Merge-base with `main` | `docs/` in tip                |
| ------------------------------------- | --------- | ---------------------------- | --------------------- | ---------------------- | ----------------------------- |
| `dev/camera-android-ready`            | `c664caf` | 2                            | 2 / 0                 | `a0bb3e5` (= `main`)   | normal tree                   |
| `dev/camera-parent-ready`             | `4b0e189` | 4                            | 4 / 159               | `453bc4f`              | submodule gitlink (`7b890df`) |
| `dev/camera-android-fixes-checkpoint` | `1c5dfde` | 1                            | 1 / 168               | `af8fca5`              | submodule gitlink (`d4fe47b`) |

- `af8fca5` is `docs: bump the docs submodule to the merged docs main` (2026-09-29). It has 168 commits on `main` not on it and 0 the other way.
- `dev/camera-android-ready` is checked out at `C:/Users/mattm/.codex/worktrees/camera-android/feral-spotter`. `dev/camera-parent-ready` is at `.../camera-release/feral-spotter`. `dev/camera-android-fixes-checkpoint` has no worktree.
- None of the three branches is on `origin` (`git ls-remote --heads origin 'dev/*'` returned nothing).
- `dev/camera-android-ready` has the same base as `main`, so `main` can fast-forward to it (`main` is an ancestor).
- `dev/camera-parent-ready` and `dev/camera-android-fixes-checkpoint` do not contain `main` (`main` is not an ancestor).

## 2. Commits unique to each branch (`main..branch`)

| Branch                                | Commit    | Date       | Subject                                                           | Parents                     |
| ------------------------------------- | --------- | ---------- | ----------------------------------------------------------------- | --------------------------- |
| `dev/camera-android-ready`            | `c664caf` | 2026-10-02 | fix(camera): enable native capture and independent tap focus      | `3fdb50b`                   |
|                                       | `3fdb50b` | 2026-10-02 | fix(camera): retain gallery files and render current photo counts | `a0bb3e5`                   |
| `dev/camera-parent-ready`             | `4b0e189` | 2026-10-02 | fix(camera): enable native capture and independent tap focus      | `3b01e80`                   |
|                                       | `3b01e80` | 2026-10-02 | chore(camera): reconcile parent with merged Android baseline      | `07e212f` `453bc4f` (merge) |
|                                       | `07e212f` | 2026-10-02 | fix(camera): retain gallery files and render current photo counts | `4c1bd9f`                   |
|                                       | `4c1bd9f` | 2026-10-02 | chore(camera): reconcile shared workflow with main                | `4b1eeb9` `3f6bb2c` (merge) |
| `dev/camera-android-fixes-checkpoint` | `1c5dfde` | 2026-10-02 | fix(camera): enable native capture and independent tap focus      | `af8fca5`                   |

- All commit bodies above are empty. Only subject lines exist.
- Same subject, different hash: `c664caf` = `4b0e189` = `1c5dfde` (see patch equivalence below). `3fdb50b` = `07e212f`.
- `git show --stat` of each: `c664caf` and `1c5dfde` each show 5 files, +105 −8. `3fdb50b` and `07e212f` each show 4 files, +316 −23.

## 3. Relations between branches

| Pair                                          | Commits only on first / only on second | Ancestry                            |
| --------------------------------------------- | -------------------------------------- | ----------------------------------- |
| `android-fixes-checkpoint` vs `android-ready` | 1 / 170                                | neither is an ancestor of the other |
| `android-fixes-checkpoint` vs `parent-ready`  | 1 / 13                                 | neither is an ancestor of the other |
| `android-ready` vs `parent-ready`             | 161 / 4                                | neither is an ancestor of the other |

Patch-equivalence (`git cherry`, `-` = equivalent patch exists upstream):

- `git cherry dev/camera-android-ready dev/camera-android-fixes-checkpoint` → `- 1c5dfde`. A patch equal to `1c5dfde` exists on `android-ready` (`c664caf`).
- `git cherry dev/camera-parent-ready dev/camera-android-fixes-checkpoint` → `- 1c5dfde` only (1 line). A patch equal to `1c5dfde` exists on `parent-ready` (`4b0e189`).
- `git cherry dev/camera-parent-ready dev/camera-android-ready` → 2 `-` lines and 126 `+` lines. The 2 `-` lines are `3fdb50b` and `c664caf` (equivalents of `07e212f` and `4b0e189`). The 126 `+` lines are commits that `android-ready` has from `main` and `parent-ready` lacks.
- `git cherry dev/camera-android-ready dev/camera-ios-ready` → `- 2ddf7ef`, `- 7f758cc`, `+ c4939aa`. The first two commits on `ios-ready` have patch-equivalents on `android-ready`. `c4939aa` is the iOS Swift commit.

## 4. Code changes (the same on all three branches, as shown in section 5)

Own changes of `dev/camera-android-ready` against `main`: 9 files, +421 −31 (`git diff --stat main dev/camera-android-ready -- src`). `dev/camera-parent-ready` has the identical 9-file result against `main` (`git diff --stat main...dev/camera-parent-ready`). `dev/camera-android-fixes-checkpoint` has 5 of the 9 files (the `1c5dfde` / `c664caf` set).

Line numbers are on the new side (`android-ready` / `parent-ready` tip). The 5 files from `1c5dfde` have identical content on `android-fixes-checkpoint`.

### 4.1 From `c664caf` / `4b0e189` / `1c5dfde` (5 files, +105 −8)

| File                                                         | Lines (new side)                    | Change                                                                                                                                                                          |
| ------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/useNativeCameraCapture.tsx`                       | 252-256 (+5), 289 (+1)              | Adds `focus` callback: returns `false` if `cameraRef.current` is missing, else calls `cameraRef.current.focus(point)`. Returns `focus` from the hook.                           |
| `src/screens/camera/NativeCameraScreen.tsx`                  | 41, 74, 76 (lines removed here), 80 | Tap handler uses `focus` instead of `applySubjectRegion`. The zero-size region (`width: 0, height: 0`) and its comment are removed. Dependency array is `[focus, previewSize]`. |
| `src/hooks/useSettingsStore.ts`                              | 68                                  | `native_camera_capture` default (`EXPO_PUBLIC_NATIVE_CAMERA_CAPTURE`, lines 66-69) changes from `false` to `true`.                                                              |
| `src/hooks/__tests__/useNativeCameraCapture.focus.test.ts`   | 1-58                                | New test file, 58 lines.                                                                                                                                                        |
| `src/hooks/__tests__/useSettingsStore.nativeDefault.test.ts` | 1-37                                | New test file, 37 lines.                                                                                                                                                        |

### 4.2 From `3fdb50b` / `07e212f` (4 files, +316 −23)

Present on `android-ready` and `parent-ready`. Absent from `android-fixes-checkpoint`.

| File                                                    | Lines (new side)                                         | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/camera/capturedPhotoFiles.ts`                  | 10-11, 16-29, 39-80                                      | Adds a retain/release hold map (`retainedFiles`, `RetainedFile { holds, deleteRequested }`). Adds `isCapturedPhotoFile`, `deleteFile`, `retainCapturedPhotoFile`, `releaseCapturedPhotoFile`. `deleteCapturedPhotoFile` now defers the delete while a hold exists. Header comment now says gallery saves add a temporary hold.                                                                                                                                                                                                      |
| `src/lib/camera/__tests__/capturedPhotoFiles.test.ts`   | 7-11, 58-81                                              | Tests for the new retain/release behavior (+24 at 58-81).                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `src/hooks/useCapturedPhotoWorkflow.tsx`                | 19-22, 105-109, 112, 145-154, 161-162, 189, 194-196, 200 | Imports `releaseCapturedPhotoFile`, `retainCapturedPhotoFile`. Retains the file before pushing to `pendingGallerySaves` when `keepOnDevice`. Wraps `gallerySavePermission.check()` in `try`/`catch` (logs `[useCapturedPhotoWorkflow] gallery permission:`) and releases all held URIs when not permitted. Adds `finally { releaseCapturedPhotoFile(uri) }`. Removes the `photoCount` ref and its `useEffect` (old lines 172-179). `badgeCount` now uses `capturedPhotos.length` and `[capturedPhotos.length, handleDiscardPhoto]`. |
| `src/hooks/__tests__/useCapturedPhotoWorkflow.test.tsx` | 1-204                                                    | New test file, 204 lines.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## 5. Direct tree comparisons

- `dev/camera-android-ready` vs `dev/camera-parent-ready`, `git diff --stat -- src modules`: empty. The source and module trees are identical.
- `dev/camera-android-ready` vs `dev/camera-parent-ready`, full tree excluding `docs/`: 9 files, +54 −172. All are tooling files: `.claude/settings.json`, `.githooks/pre-commit`, `.githooks/pre-push`, `.gitignore`, `.gitmodules`, `commitlint.config.js`, `scripts/format-changed.mjs`, `scripts/format-shared.mjs`, `scripts/format-staged.mjs`. `parent-ready` carries the older versions (it is 159 commits behind `main`; `.gitmodules` is present there because `docs/` is still a submodule).
- `dev/camera-android-fixes-checkpoint` vs `dev/camera-android-ready` on the 5 files from `1c5dfde`: identical (no diff).
- `dev/camera-android-fixes-checkpoint` vs `dev/camera-android-ready`, full tree: 24 files, +660 −92. They split into three groups:
  - Files from `3fdb50b` that `android-fixes-checkpoint` lacks: `src/hooks/useCapturedPhotoWorkflow.tsx`, `src/hooks/__tests__/useCapturedPhotoWorkflow.test.tsx`, `src/lib/camera/capturedPhotoFiles.ts`, `src/lib/camera/__tests__/capturedPhotoFiles.test.ts`.
  - Tooling files (the 9 listed in the previous bullet). Inference, not checked commit by commit: they come from the 168-commit gap to `main`.
  - Other files. Inference, not checked commit by commit: they arrived on `main` after the old base: `src/hooks/useSubmissionSubmit.ts`, `src/hooks/__tests__/useSubmissionSubmit.submitFlow.test.ts`, `src/screens/home/index.tsx`, `src/screens/home/index.styles.ts`, `src/screens/home/__tests__/HomeScreen.photoSourceGate.model.test.tsx`, `src/screens/submission/annotate/index.tsx`, `src/screens/submission/annotate/index.styles.ts`, `src/screens/submission/annotate/__tests__/AnnotateScreen.buttons.test.tsx`, `src/screens/submission/create/index.tsx`, `src/screens/submission/create/index.styles.ts`, `src/screens/submission/create/__tests__/CreateScreen.catListActions.test.tsx`.
- `git diff --stat main...dev/camera-android-fixes-checkpoint` reports 5 files, +105 −8. This matches `1c5dfde`.

## 6. Observed facts, stated plainly

- `android-fixes-checkpoint` holds one commit of code (`1c5dfde`). That patch is also on `android-ready` (`c664caf`) and `parent-ready` (`4b0e189`). The code in those 5 files is identical on all three.
- `android-ready` and `parent-ready` have identical `src/` and `modules/` content. They differ only in tooling files and in `docs/` (tree versus submodule pointer).
- `parent-ready` has two extra merge commits (`4c1bd9f`, `3b01e80`) that `android-ready` lacks. These carry no `src/` or `modules/` difference between the two branches' tips.
- `android-ready` is the only one of the three whose base is current `main`.
- `ios-ready` contains patch-equivalents of both `android-ready` commits (`2ddf7ef` = `3fdb50b`, `7f758cc` = `c664caf`) plus the iOS Swift commit `c4939aa`.
- No Kotlin file differs among the three branches. All Android-specific code changes are TypeScript (hooks, screen, camera file helper).
- All three commit messages are subject-line only. No commit body states test or device results for these branches.
- Not checked: whether tests, linter or typecheck pass on any of these tips.
