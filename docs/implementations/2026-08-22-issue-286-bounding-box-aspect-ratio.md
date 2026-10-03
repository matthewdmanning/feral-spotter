---
title: Feature implementation draft
aliases:
  - Feature implementation note
tags:
  - template
  - implementation
---

# Box Annotation crop frame: non-square aspect ratio

**Scope:** feature
**Issues/spec:** #286
**Date:** 2026-08-22
**Branch/PR:** `issue-286-bounding-box-aspect-ratio` (no PR opened yet)

## Scope

**In scope:**

- [x] Non-square (independent width/height) resizing of the Box Annotation crop frame via four edge-drag handles
- [x] Handles positioned inset on the crosshairs rather than at the box border
- [x] Disable carousel swipe-to-change-photo on the annotate screen (gesture-conflict fix)

**Out of scope / not addressed:**

- Photo pinch/pan/double-tap gesture behavior — unchanged
- Resume-shape fidelity for a previously confirmed non-square box on re-open — implemented via the existing `initialBox` effect but not verified on-device this session
- Interaction between an active handle-drag and a simultaneous photo pinch/pan — not tested

## Intent

**Purpose:** Cats aren't square; a fixed 1:1 crop forced a bad fit for tall or wide poses. Letting the user reshape the frame's aspect ratio produces crops that better match the actual animal, without adding a second UI mode — resize handles layer directly onto the frame the user already has open.

## Design decisions and reasoning

### Center-anchored, mirrored resize

- **Decision:** each edge handle only changes its own half-extent (half-width for left/right, half-height for top/bottom); the opposite edge mirrors automatically since the frame is always drawn from the same center.
- **Reason:** keeps the frame's center fixed on the crosshair the user is already aligning with the subject — a non-mirrored resize would drift the frame off-target with every drag.
- **Affected journey/state:** Box Annotation crop step, before Confirm.
- **Related decision:** [[box-annotation-crop-frame]]

### Handles inset on the crosshairs

- **Decision:** handles sit `HANDLE_INSET` inward from the box edge, on the crosshair line, rather than straddling the border.
- **Reason:** at the edge, handles were easy to trigger by accident alongside the carousel's swipe gesture, and harder to grab precisely; the crosshair is a fixed, predictable landmark regardless of box size.
- **Affected journey/state:** Box Annotation crop step.
- **Related decision:** [[box-annotation-crop-frame]]

### Disable carousel swipe

- **Decision:** the annotate screen's carousel no longer responds to horizontal swipe; navigation is the Previous button plus automatic advance on Confirm/Not in Photo only.
- **Reason:** swipe competed with handle-drag and pinch-zoom for the same touch input, causing accidental photo changes mid-resize.
- **Affected journey/state:** Box Annotation, moving between photos in a pass.
- **Related decision:** [[box-annotation-crop-frame]]

## What shipped

- `src/hooks/useBoundingBoxFrame.ts`: four new `Gesture.Pan()` handles (left/right/top/bottom), `HANDLE_INSET`/`MAX_ASPECT_RATIO` tunables added to `BOUNDING_BOX_FRAME_TUNABLES`, `MIN_HALF_EXTENT` widened by `HANDLE_INSET` so handles stay clear of the confirm dot's own hitbox at minimum box size.
- New pure-math module `src/lib/annotate/boxResize.ts` (`clampHalfExtent`, `clampAspectRatio`, `maxHalfExtentForBox`) — kept separate from the hook because worklets have no native init in Jest and aren't unit-testable.
- `src/components/organisms/AnnotateCarouselItem.tsx` / `.styles.ts`: renders the four handle touch targets and visual bars, positioned via `HANDLE_INSET`.
- `src/screens/submission/annotate/index.tsx`: carousel `enabled` hardcoded to `false`; removed the now-dead `zoomedIn` state and `onZoomChange` wiring that used to gate it.

## Tests

**Model or flow covered:** N/A — pure math and component wiring, not a stateful flow.

| Test file                                                              | What it verifies                                                             |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `src/lib/annotate/__tests__/boxResize.test.ts`                           | `clampHalfExtent`, `clampAspectRatio`, `maxHalfExtentForBox` in isolation      |
| `src/screens/submission/annotate/__tests__/AnnotateScreen.buttons.test.tsx` | Updated button-label assertion ("Done With This Cat")                       |

**Not tested:**

- Gesture feel/interaction (handle-drag vs. simultaneous photo pinch/pan) — not Jest-testable, worklets have no native init
- Resume-shape fidelity for a previously confirmed non-square box

## Verification status

**Run and passing:**

- [x] Type checking: `npx tsc --noEmit`
- [x] Unit tests: `npx jest src/screens/submission/annotate src/hooks/useBoundingBoxFrame src/lib/annotate` (24/24)
- [x] Lint: `npx expo lint` (0 errors; pre-existing unrelated `require()` warnings only)
- [x] Device pass (Pixel 7, physical, `EXPO_PUBLIC_AUTH_MOCK=true` workaround — see Graveyard): confirmed handles render inset on the crosshairs (~20dp inward, matches `HANDLE_INSET`), a right-handle drag reshapes the box non-square with correct mirroring, Confirm succeeds without a crash, and the carousel does not swipe/navigate during a handle drag. No `FATAL`/`AndroidRuntime` exceptions in logcat.

**Unverified:**

- Formatting (`format:check`) not run separately — applied via the commit's pre-commit hook (prettier)
- Full repo-wide test/lint run beyond the targeted suites above

## Graveyard: pivots and corrections

### Device pass blocked by an unrelated, pre-existing Firebase Auth failure

- **Finding:** real Google Sign-In failed on-device with two different errors across this session (`NO_GOOGLE_ID_TOKEN`, then `[auth/unknown] API key expired` after a `google-services.json` re-download) — unrelated to #286, discovered while setting up a device pass for this feature.
- **Impact:** none on #286's implementation. Used `EXPO_PUBLIC_AUTH_MOCK=true` as a workaround to drive the device for this feature's verification, reverted `.env.local` back to `false` afterward.
- **Resolution:** filed as a separate finding, not part of this feature's scope — see `docs/test-drives/run-notes/2026-08-22-issue283-286-drive.md`.

## Follow-ups and known limitations

- [ ] Resume-shape fidelity for a previously-confirmed non-square box not verified on-device
- [ ] Handle-drag vs. simultaneous photo pinch/pan interaction not tested
- No PR opened yet as of this note
