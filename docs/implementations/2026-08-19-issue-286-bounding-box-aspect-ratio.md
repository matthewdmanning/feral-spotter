# Box Annotation: adjustable bounding-box aspect ratio

**Scope:** feature
**Issues/spec:** [#286](https://github.com/matthewdmanning/feral-spotter/issues/286)
**Date:** 2026-08-19
**Branch/PR:** `issue-286-bounding-box-aspect-ratio`

## Scope

**In scope:**

- [x] Box Annotation's crop frame can be reshaped to a non-square aspect ratio, not just the hardcoded 1:1 square.
- [x] Discoverable, direct-manipulation UI for reshaping (four edge handles).

**Out of scope / not addressed:**

- Ratio snapping (e.g. snap-to-square) — explicitly rejected, fully free-form.
- A numeric ratio readout while dragging — explicitly rejected, box shape is the only feedback.
- Free-floating/draggable box position — box stays center-anchored, matching the existing fixed-crosshair model.
- Remembering the last-used ratio as the next photo's default — every fresh photo still starts from the same default box.

## Intent

**Purpose:** Cats aren't square. A crop frame locked to 1:1 forces a worse-fitting box on many poses/photos than a frame the user can stretch to match the cat's actual silhouette. Found via the 2026-08-19 Annotation Tutorial test drive.

## Design decisions and reasoning

Reached via a `/grilling` session (see conversation) before implementation. Several early decisions were explicitly reversed mid-session — see Graveyard below for the full pivot; only the decisions that survived are recorded here.

### Box stays center-anchored, only its shape changes

- **Decision:** The box remains fixed at screen-center, same as the original 1:1 crosshair. Only its width/height become independently adjustable. The photo still pans/zooms underneath it to position the cat.
- **Reason:** Smallest change from the existing `useBoundingBoxFrame` model; avoids a much larger rework into a free-floating crop-box UI, and keeps the existing pan-clamp math (`panClamp.ts`) untouched.
- **Affected journey/state:** `useBoundingBoxFrame`'s screen-space box rect, `AnnotateCarouselItem`'s crosshair rendering.

### Aspect ratio changes via draggable edge handles, not pinch

- **Decision:** Four new handles at the box's edge midpoints (left/right/top/bottom), each single-finger-draggable, independently push their own edge in/out from center. Pinch/pan/double-tap on the photo are **fully unchanged** — pinch still only zooms the photo, exactly as before.
- **Reason:** The original ask was "pinch motions," but pinch was already fully claimed by photo-zoom. A decomposed/dual-purpose pinch (reshape vs. zoom, disambiguated by touch location) was explored and initially chosen, then explicitly reversed — see Graveyard. Edge handles give a zero-ambiguity gesture surface: no touch-routing conflict with the existing photo gestures at all.
- **Affected journey/state:** `useBoundingBoxFrame`'s four new `Gesture.Pan()` instances; `AnnotateCarouselItem`'s handle overlays.

### Both a minimum size floor and a maximum aspect-ratio cap

- **Decision:** Each half-extent is clamped to `[MIN_HALF_EXTENT, canvas/photo bound]`, and additionally the width:height ratio is capped at `MAX_ASPECT_RATIO` (3), independent of the absolute-size clamp.
- **Reason:** A minimum stops the box collapsing to an unusable/ungrabbable sliver; the ratio cap additionally stops a technically-on-canvas but uselessly thin box (e.g. full canvas width, near-zero height).
- **Affected journey/state:** `src/lib/annotate/boxResize.ts` (`clampHalfExtent`, `clampAspectRatio`).

### Box's max size is bounded by the photo's live on-screen extent, not just the canvas

- **Decision:** `maxHalfExtentForBox` bounds handle-drag growth to `min(canvasHalf, photoHalfExtent * userScale)`, re-evaluated on every pinch update too.
- **Reason:** Not an explicit grilling decision — caught by `advisor()` review before implementation. Bounding only by canvas size lets the box grow past the actual (possibly letterboxed or zoomed-out) photo. `handleConfirm`'s existing `clampX`/`clampY` would then silently trim the confirmed corners to the image bounds, corrupting the very aspect ratio the user just set — and since resuming a saved box re-derives its aspect ratio from the stored corners, the corruption would persist and reshape the box again on the next visit.
- **Affected journey/state:** `useBoundingBoxFrame`'s pinch `onUpdate` and the four handle gestures' `onUpdate`.

### Handle-drag must win over the photo's own pan

- **Decision:** `pan.blocksExternalGesture(leftHandle, rightHandle, topHandle, bottomHandle)`.
- **Reason:** Also caught by `advisor()`, not the grilling session — a handle is a `Gesture.Pan()` sitting on top of the photo's own `Gesture.Pan()`-based drag. Without an explicit block, RNGH could let both activate simultaneously, so the photo would visibly pan under the finger while the user is trying to reshape the box.
- **Affected journey/state:** `useBoundingBoxFrame`'s `photoGesture` composition.

### Default box size: 0.85 of the shorter canvas axis, not full-bleed

- **Decision:** Fresh (never-confirmed) photos start with a box sized to `DEFAULT_BOX_FRACTION` (0.85) × the shorter canvas axis, rather than the old behavior of exactly the shorter axis (edge-to-edge, no margin).
- **Reason:** Explicit correction mid-grilling: the old default effectively spanned the entire screen on its constrained axis; a small inset makes the box's own boundary visible/grabbable from the start.
- **Affected journey/state:** `useBoundingBoxFrame`'s initial `boxHalfWidth`/`boxHalfHeight` and the resume-effect's re-derivation of a saved box's size.

## What shipped

- **`src/lib/annotate/boxResize.ts`** (new): three pure, worklet-safe functions — `clampHalfExtent`, `clampAspectRatio`, `maxHalfExtentForBox` — mirroring the existing `panClamp.ts` split (worklets aren't testable in Jest; the math they call is).
- **`src/hooks/useBoundingBoxFrame.ts`**: box state generalized from a single fixed `squareSize` to independent `boxHalfWidth`/`boxHalfHeight` shared values. Added four `Gesture.Pan()` instances (one per edge), each mirrored around center so the opposite edge follows automatically. `handleConfirm`'s corner-projection math generalized from a square to an arbitrary rect. The resume effect (reopening an already-boxed photo) now re-derives the saved box's aspect ratio and solves the single photo scale that reproduces it, instead of assuming square. New tunables: `HANDLE_HITBOX_RADIUS`, `MIN_HALF_EXTENT`, `MAX_ASPECT_RATIO`, `DEFAULT_BOX_FRACTION`.
- **`src/components/organisms/AnnotateCarouselItem.tsx`**: box/crosshair rendering switched from static `squareSize` to `useAnimatedStyle`s driven by the live `boxHalfWidth`/`boxHalfHeight` shared values. Four new handle overlays (`GestureDetector` + small accent-colored bar), each wired to its own edge gesture.
- **`src/components/organisms/AnnotateCarouselItem.styles.ts`**: renamed `square` → `box`; added `handleTouchArea`/`handleBar`/`handleBarVertical`/`handleBarHorizontal`.
- No changes to `BoundingBox` (type or store) — corners were already stored as normalized rect coordinates, which already generalize to any aspect ratio.

## Tests

**Model or flow covered:** N/A — this is worklet gesture math with a pure-function core, not a stateful UX flow; per `docs/agents/testing.md` this doesn't warrant an XState model (same call the existing `panClamp.test.ts` precedent made).

| Test file                                       | What it verifies                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/annotate/__tests__/boxResize.test.ts`   | `clampHalfExtent` bounds; `clampAspectRatio` caps a too-wide/too-thin ratio scaled off the fixed axis; `maxHalfExtentForBox`'s canvas-vs-photo bound selection, including the degenerate zero-size-photo fallback. |

**Not tested:**

- Actual on-device handle-drag feel, the `blocksExternalGesture` fix (whether the photo genuinely stays still while dragging a handle), and whether the resume-effect's re-derived box visually matches the previously-confirmed crop — none of this is Jest-exercisable (worklets have no native init), and no emulator/device pass has been run yet. This is exactly why the user asked to "wire it up for device testing" next.

## Verification status

**Run and passing:**

- [x] Type checking: `npx tsc --noEmit`
- [x] Unit tests: `npx jest` — 50 suites / 225 tests, full suite, no regressions
- [x] Lint: `npx eslint` on all changed files
- [x] Formatting: `npx prettier --check` on all changed files (one file needed `--write`, applied)

**Unverified:**

- On-device/emulator pass — gesture feel, the handle-vs-photo-pan blocking fix, and resume-shape fidelity all need a physical device or emulator, not yet run.

## Graveyard: pivots and corrections

### Pinch was the original mechanism; reversed to edge handles

- **Finding:** The original ask ("this will be done using pinch motions") collided with the fact that pinch already fully means "zoom the photo" in `useBoundingBoxFrame`. Mid-session the design moved through several intermediate states before landing: (1) fixed-centered frame with location-gated pinch → rejected in favor of (2) a full free-floating/resizable crop box → narrowed back to (3) center-anchored resize, with pinch decomposed into independent X/Y box-reshape components (fingers' horizontal spread → width, vertical spread → height) plus four edge-midpoint handles as a complementary single-finger fine-tune.
- **Impact:** Design (3) would have required routing two-finger pinch by touch-target (box vs. photo background) to avoid it colliding with photo-zoom pinch — a real gesture-disambiguation problem, not just an implementation detail.
- **Resolution:** Explicitly walked back to: photo pinch/pan/double-tap stay **completely unchanged**, and aspect ratio is handled **only** by the four edge handles (single-finger drag). This is what shipped. No two-finger pinch-based box-reshape gesture exists in the final implementation, despite the original request naming pinch specifically — confirmed explicitly with the user before implementation began.

## Follow-ups and known limitations

- [ ] On-device test drive — confirm handle drag doesn't fight the photo pan, confirm resume-shape fidelity for a non-square saved box, tune `MIN_HALF_EXTENT`/`MAX_ASPECT_RATIO`/`DEFAULT_BOX_FRACTION` (0.85) if they feel wrong in hand.
- The photo-zoom-then-box-overhang interaction is only bounded, not perfectly solved: `maxHalfExtentForBox` bounds growth by the photo's half-extent from its own center, not by where the photo is currently panned to — a box grown near the photo's zoom-derived bound, on a photo panned to its translate limit, can in principle still slightly overhang the photo edge on the pan-direction side. This edge case pre-dates this change (the original fixed-square frame had the same latent gap, mitigated only by `handleConfirm`'s corner clamp) and wasn't re-solved here; flagged, not fixed.
