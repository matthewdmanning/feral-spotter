# Annotate: UI and gesture polish (#204)

## What shipped

1. **`Boxing Complete` label centered** (`src/screens/submission/annotate/index.styles.ts`): added `textAlign: 'center'` to `navBtnPrimaryText`. The button has no horizontal padding and shares a row with two other buttons (`flex: 1` each, ~107px wide on a 390px-wide screen after the pill button and gaps) — "Boxing Complete" at `fontSize: 15, fontWeight: '700'` is wide enough to wrap to two lines, and an un-centered second line was the actual defect (the button itself, via `alignItems/justifyContent: 'center'`, was already centering a single line).
2. **`Back` → `Previous`** (`src/screens/submission/annotate/index.tsx`): label text changed from `"← Back"` to `"← Previous"`.
3. **Photo drag constrained to the center crosshair** — new pure module `src/lib/annotate/panClamp.ts` (`halfExtentOnScreen`, `maxTranslateForScale`, `clampTranslate`), wired into `pan.onUpdate` and `pinch.onUpdate` in `src/hooks/useBoundingBoxFrame.ts`. Derivation: the image's on-screen half-extent from its own center is `(imgSize * baseScale) / 2` at `scale=1`; the canvas center (crosshair) stays inside the image's bounds exactly while `|translate| <= scale * halfExtent`. Re-clamped on pinch too, so zooming out doesn't push an already-panned-to-the-limit photo out of bounds.
4. **Swipe-up triggers "Not in Photo"** — net new (grepped first; nothing like this existed before this issue). Added `onNotInPhoto` to `useBoundingBoxFrame`'s pan `onEnd`: fires when not zoomed in, `translationY < -40`, and `velocityY < -800` (`NOT_IN_PHOTO_SWIPE_VELOCITY` in `BOUNDING_BOX_FRAME_TUNABLES`, alongside the existing gesture tunables — a named source constant, not a runtime setting; "configurable" is satisfied the same way `MIN_SCALE`/`HOLD_DURATION_MS`/etc. already are). Threaded through `AnnotateCarouselItem` → `annotate/index.tsx`'s existing `handleNotInPhoto`, gated on `activeCatId` to mirror the button's own `disabled={!activeCatId}`.

## Known tension (documented, not resolved)

Item 3's clamp and item 4's fling share the same `pan` gesture. On the _non-fitting_ axis of a contain-fit photo (e.g. a wide photo in a tall canvas), `halfExtentY` is small, so `userTranslateY` can pin well before a real upward flick's finger travel completes — the photo visually stops moving under the finger while the flick is still in progress. This doesn't break the fling (the threshold checks read the gesture's own `translationY`/`velocityY`, not the clamped shared value, so triggering is unaffected), but it may _feel_ like the photo jammed rather than register as a deliberate gesture. Could not verify feel without a device. If on-device testing shows this is a real problem, the fix is to stop sharing state between the clamp and the fling — a separate `Gesture.Fling().direction(Directions.UP)` composed via `Gesture.Race` with `pan`, rather than layering the fling onto the same gesture that owns the clamped translate.

Also unverified: whether a fast double-tap could leak into the fling threshold, since `photoGesture = Gesture.Simultaneous(pinch, pan, doubleTap)` runs all three together. Added a `translationY < -40` displacement floor alongside the velocity check specifically to rule this out, but didn't confirm on-device that a real double-tap's `velocityY` stays under it.

## Tests

- `src/lib/annotate/__tests__/panClamp.test.ts` — the three pure clamp functions in isolation, plus an end-to-end case (pinch-zoom-out re-clamping an existing at-the-limit translate). This is the only part of items 3/4 that's actually testable — worklets have no native init in Jest, which is also why the pure math lives in its own module with no reanimated import (mirrors `src/lib/insetCrop/diameter.ts`'s split from `InsetCropBubble`).
- No test for items 1/2 (styling/copy) or item 4's gesture wiring itself — gesture feel isn't something Jest can exercise; see verification table below.

## Verification

| Criterion                     | Status                                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. `Boxing Complete` centered | Verified by layout math (button width vs. text width), not an on-device screenshot                                                                                          |
| 2. `Back` → `Previous`        | Verified by inspection (literal string change)                                                                                                                              |
| 3. Drag clamp                 | Clamp math unit-tested; actual drag feel on-device unverified                                                                                                               |
| 4. Swipe-up gesture           | Implemented, wired, gated; **not verified on device** — velocity/displacement thresholds are untuned starting points, and the item-3/item-4 interaction above is unresolved |

- `npx tsc --noEmit` — clean
- `npx eslint` on all changed files — clean
- `npx jest` — 120/120 passing (full suite, no regressions)
- Issue is labeled `needs-physical-device`; none of items 3/4 have had that pass yet.
