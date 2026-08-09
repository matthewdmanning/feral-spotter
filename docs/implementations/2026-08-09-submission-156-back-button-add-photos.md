# Submission Details: remove back button, add bottom photo-add action

Covers #156 (part of #154's sprint:submission-details cluster).

## What shipped

- `src/app/submission/_layout.tsx`: `create` step's `Stack.Screen` now overrides `headerBackVisible: false` and `gestureEnabled: false`, scoped to that screen only — the shared `screenOptions.gestureEnabled: true` and the `cats` step's back/gesture behavior are untouched.
- `src/screens/submission/create/index.tsx`: new bottom action button, placed above the existing Finished!/Reset buttons. Label and press behavior read directly from `usePhotoStore().source` (no new state, per spec):
  - `source === 'camera'` → "Take More Photos", `router.navigate('/camera')` (same route Home's camera entrypoint uses).
  - `source === 'library'` (or `null`, unreachable here per spec) → "Select More Photos", calls `useLibraryPhotoPicker().pickFromLibrary()` directly — the same hook Home uses, which already navigates back to `/submission/create` after the pick.
- `src/screens/submission/create/index.styles.ts`: `addPhotosBtn`/`addPhotosBtnText` styles, bordered/neutral to read as secondary against the primary Finished! button.

## Tests

- `src/screens/submission/create/__tests__/CreateScreen.addMorePhotosAction.model.test.tsx` (new, model-based per testing policy): 2-state machine (`camera` / `library`) over `usePhotoStore().source`, driven with `getPathsFromEvents`. Asserts the correct label renders and that pressing it calls `router.navigate('/camera')` in the camera state and `pickFromLibrary()` in the library state.
- The header-back/gesture removal is static `Stack.Screen` options config, not branching business logic — no model test written for it; verified by reading the resulting options object.

## Verification

- `npx tsc --noEmit`: clean.
- `npx eslint` on changed files: clean (one pre-existing `no-require-imports` warning shared with every other test file in this repo that mocks `@react-native-async-storage/async-storage`, not new).
- `npx jest`: full suite green, 111/111 including the 2 new cases.
- Not verified: no emulator/device pass — header back-button removal and the new button's on-screen placement/behavior are unconfirmed visually.
