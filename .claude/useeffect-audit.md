# useEffect Audit — 2026-07-02

Audited all `useEffect` calls in `src/` against the React "You Might Not Need an Effect" docs.

## Changes applied

### `src/hooks/usePhotoSession.ts`

**Removed** the auto-check effect that called `setChecked` when `sessionPhotos` changed:

```js
// Before — setState inside effect (cascading render)
useEffect(() => {
  setChecked((prev) => {
    /* add new photos */
  })
}, [sessionPhotos])
```

**Fix:** Inverted the state model. Instead of tracking all checked IDs, track only explicitly-_unchecked_ IDs (`Set<string>`). New photos are checked by default without any effect — `checked` is computed inline during render from `sessionPhotos` and `unchecked`.

### `src/screens/submission/create/index.tsx`

**Removed** the no-dependency-array effect used solely to keep a ref up to date:

```js
// Before — useEffect to sync a ref
useEffect(() => {
  formRef.current = { locationType, timeType, address }
})
```

**Fix:** Assign the ref inline during render. Refs are mutable values React owns; they don't need an effect to update, and updating them in render is safe when the ref is only read in callbacks (not during render).

### `src/hooks/useSettingsDraft.ts`

**Removed** the effect that re-synced `draft` state from `savedSettings` on every change:

```js
// Before — "sync state from props" anti-pattern
useEffect(() => {
  setDraft({ ...savedSettings })
}, [savedSettings])
```

**Fix:** Deleted. `draft` is already initialised from `savedSettings` in `useState`. `savedSettings` does not change while the settings screen is mounted (saving navigates back first), so this effect was redundant and caused an extra render on every settings store update.

## Effects confirmed necessary (not changed)

| File                          | Why it's necessary                                                   |
| ----------------------------- | -------------------------------------------------------------------- |
| `_layout.tsx`                 | NetInfo subscription + cleanup                                       |
| `useBackHandler.ts`           | BackHandler subscription + cleanup                                   |
| `useAuth.ts`                  | Firebase auth state subscription                                     |
| `home/index.tsx` (×3)         | Async first-launch check; BackHandler; async cache load              |
| `BottomButtonColumn.tsx`      | Drives Reanimated SharedValues (UI thread)                           |
| `useBoundingBoxFrame.ts`      | Initialises Reanimated SharedValues from `initialBox`                |
| `submission/create/index.tsx` | Async cache init + isMountedRef/timer cleanup                        |
| `useCameraCapture.tsx`        | `scrollToEnd` on FlashList ref                                       |
| `ValidationSheet.tsx`         | `snapToIndex`/`close` on BottomSheet ref                             |
| `useFeralReports.ts`          | Async data fetch on mount                                            |
| `useSettingsDraft.ts`         | Async `hasPassword()` check on mount                                 |
| `usePhotoSession.ts`          | `setCurrentStep('photos')` — updates external Zustand store on mount |

## Flagged but not changed

- **`useAnnotateStateMachine.ts:82`** — calls both `setCurrentIndex` (state) and `carouselRef.current?.scrollTo` (imperative API) in one effect. The scroll requires an effect; the setState is the lint violation. Real fix: compute clamped index during render, keep effect only for scroll. Non-trivial refactor; low risk to leave.
- **`useCatSubmit.ts` / `useFeralReports.ts`** — both call `registerCapture(posthog.capture)` in separate hooks. Each effect is individually valid, but the duplication suggests `registerCapture` should be called once in `AppProviders`. Out of scope.
