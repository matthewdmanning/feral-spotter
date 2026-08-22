/**
 * hooks/useBoundingBoxFrame.ts
 *
 * Center-anchored, resizable crop frame: the box crosshair stays centered on
 * screen while the user pinches/pans/double-taps the photo underneath it to
 * position and zoom (unchanged), and independently drags one of the four
 * edge handles to reshape the box's aspect ratio (#286) — each handle only
 * moves its own axis, mirrored around the center, so the opposite edge
 * follows automatically. Long-pressing the center dot (or calling
 * confirmNow() from a button) confirms. Confirming computes the box's
 * projection onto the original image as a normalised BoundingBox and hands
 * it to onConfirm.
 *
 * Requires react-native-gesture-handler + react-native-reanimated v4
 * (Reanimated SharedValues, worklet gestures).
 */

import {
  clampAspectRatio,
  clampHalfExtent,
  maxHalfExtentForBox,
} from '@/src/lib/annotate/boxResize'
import {
  clampTranslate,
  halfExtentOnScreen,
  maxTranslateForScale,
} from '@/src/lib/annotate/panClamp'
import type { BoundingBox } from '@/src/types/BoundingBox'
import { useCallback, useEffect } from 'react'
import { Gesture } from 'react-native-gesture-handler'
import {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

// ─── Tunables ───────────────────────────────────────────────────────────────
const MIN_SCALE = 0.5
const MAX_SCALE = 4
const SNAP_THRESHOLD = 0.08 // zoom-out snap-to-1 band
const DOUBLE_TAP_SCALE = 2.5
const HOLD_DURATION_MS = 650 // push time length
const DOT_HITBOX_RADIUS = 24 // button hitbox radius
const HANDLE_HITBOX_RADIUS = 36 // edge-handle hitbox radius (+50%, punchlist 2026-08-19)
// How far inward from the box edge the handles sit, on the crosshairs
// instead of straddling the border (#286 follow-up).
const HANDLE_INSET = 20
// Must clear the dot's own hitbox at minimum box size, or handle-drag and
// confirm-hold compete for the same pixels at dead center. HANDLE_INSET
// shifts handles toward center, so the margin has to grow with it.
const MIN_HALF_EXTENT = DOT_HITBOX_RADIUS + HANDLE_HITBOX_RADIUS + HANDLE_INSET
const MAX_ASPECT_RATIO = 3 // widest/tallest the box can go, either axis
const DEFAULT_BOX_FRACTION = 0.85 // initial box size, as a fraction of the shorter canvas axis
const ZOOM_REACTIVE_THRESHOLD = 1.02 // above this, treat as "zoomed in"
// #204: swipe-up-to-"Not in Photo". Needs on-device tuning — this is a
// starting point, not a measured value. Gated on not-zoomed-in (below) so a
// fast upward flick while framing a zoomed photo doesn't get misread as the
// skip gesture.
const NOT_IN_PHOTO_SWIPE_VELOCITY = 800 // px/sec, upward (negative velocityY)

export const BOUNDING_BOX_FRAME_TUNABLES = {
  MIN_SCALE,
  MAX_SCALE,
  SNAP_THRESHOLD,
  DOUBLE_TAP_SCALE,
  HOLD_DURATION_MS,
  DOT_HITBOX_RADIUS,
  HANDLE_HITBOX_RADIUS,
  HANDLE_INSET,
  MIN_HALF_EXTENT,
  MAX_ASPECT_RATIO,
  DEFAULT_BOX_FRACTION,
  ZOOM_REACTIVE_THRESHOLD,
  NOT_IN_PHOTO_SWIPE_VELOCITY,
}

interface UseBoundingBoxFrameParams {
  canvasWidth: number
  canvasHeight: number
  imgNaturalWidth: number
  imgNaturalHeight: number
  initialBox?: BoundingBox
  onConfirm: (
    box: Omit<BoundingBox, 'id' | 'cat_id' | 'photo_local_id'>,
  ) => void
  /** Fires when the photo crosses the zoomed-in threshold, for disabling carousel swipe */
  onZoomChange?: (zoomedIn: boolean) => void
  /**
   * Fires on a fast upward flick of the photo, not zoomed in (#204). Pass
   * undefined to disable the gesture entirely (e.g. no active cat yet) —
   * mirrors the Not in Photo button's own disabled condition.
   */
  onNotInPhoto?: () => void
}

export interface BoundingBoxFrameResult {
  /** Attach to the full-canvas GestureDetector wrapping the photo */
  photoGesture: ReturnType<typeof Gesture.Simultaneous>
  /** Attach to the small centered dot's own GestureDetector — render it on top */
  dotGesture: ReturnType<typeof Gesture.LongPress>
  /** Attach one each to the left/right/top/bottom edge-handle GestureDetectors */
  leftHandleGesture: ReturnType<typeof Gesture.Pan>
  rightHandleGesture: ReturnType<typeof Gesture.Pan>
  topHandleGesture: ReturnType<typeof Gesture.Pan>
  bottomHandleGesture: ReturnType<typeof Gesture.Pan>
  userScale: ReturnType<typeof useSharedValue<number>>
  userTranslateX: ReturnType<typeof useSharedValue<number>>
  userTranslateY: ReturnType<typeof useSharedValue<number>>
  /** Half the box's on-screen width/height — box spans center +/- these */
  boxHalfWidth: ReturnType<typeof useSharedValue<number>>
  boxHalfHeight: ReturnType<typeof useSharedValue<number>>
  /** 0->1 while the dot is held, for motion-only feedback (scale/opacity) */
  holdProgress: ReturnType<typeof useSharedValue<number>>
  /** Same effect as a successful long-press — call from a Confirm button */
  confirmNow: () => void
}

export function useBoundingBoxFrame({
  canvasWidth,
  canvasHeight,
  imgNaturalWidth,
  imgNaturalHeight,
  initialBox,
  onConfirm,
  onZoomChange,
  onNotInPhoto,
}: UseBoundingBoxFrameParams): BoundingBoxFrameResult {
  const userScale = useSharedValue(1)
  const userTranslateX = useSharedValue(0)
  const userTranslateY = useSharedValue(0)
  const holdProgress = useSharedValue(0)

  const savedScale = useSharedValue(1)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)

  const defaultHalfExtent =
    (Math.min(canvasWidth, canvasHeight) * DEFAULT_BOX_FRACTION) / 2
  const boxHalfWidth = useSharedValue(defaultHalfExtent)
  const boxHalfHeight = useSharedValue(defaultHalfExtent)
  const savedBoxHalfWidth = useSharedValue(defaultHalfExtent)
  const savedBoxHalfHeight = useSharedValue(defaultHalfExtent)

  // ── Resume a previously-confirmed photo: reconstruct the transform that
  // produced the saved box, instead of resetting to identity. ────────────────
  useEffect(() => {
    if (!initialBox || !imgNaturalWidth || !imgNaturalHeight) return

    const baseScale = Math.min(
      canvasWidth / imgNaturalWidth,
      canvasHeight / imgNaturalHeight,
    )
    const baseOffsetX = (canvasWidth - imgNaturalWidth * baseScale) / 2
    const baseOffsetY = (canvasHeight - imgNaturalHeight * baseScale) / 2
    const canvasCenterX = canvasWidth / 2
    const canvasCenterY = canvasHeight / 2

    const cx1 =
      baseOffsetX + initialBox.lowerLeftX * imgNaturalWidth * baseScale
    const cx2 =
      baseOffsetX + initialBox.upperRightX * imgNaturalWidth * baseScale
    const cy1 =
      baseOffsetY + initialBox.upperRightY * imgNaturalHeight * baseScale
    const cy2 =
      baseOffsetY + initialBox.lowerLeftY * imgNaturalHeight * baseScale

    const boxScreenWidth = cx2 - cx1
    const boxScreenHeight = cy2 - cy1
    if (boxScreenWidth <= 0 || boxScreenHeight <= 0) return

    // Re-derive the box's on-screen size (bounded by the same default
    // fraction fresh boxes start at) from the saved aspect ratio, then solve
    // the single photo scale that reproduces the saved crop through it.
    const maxBoxDim = Math.min(canvasWidth, canvasHeight) * DEFAULT_BOX_FRACTION
    const aspect = boxScreenWidth / boxScreenHeight
    const boxWidth = aspect >= 1 ? maxBoxDim : maxBoxDim * aspect
    const boxHeight = aspect >= 1 ? maxBoxDim / aspect : maxBoxDim

    const scale = boxWidth / boxScreenWidth
    const translateX = (canvasCenterX - (cx1 + cx2) / 2) * scale
    const translateY = (canvasCenterY - (cy1 + cy2) / 2) * scale

    userScale.value = scale
    userTranslateX.value = translateX
    userTranslateY.value = translateY
    savedScale.value = scale
    savedTranslateX.value = translateX
    savedTranslateY.value = translateY
    boxHalfWidth.value = boxWidth / 2
    boxHalfHeight.value = boxHeight / 2
    savedBoxHalfWidth.value = boxWidth / 2
    savedBoxHalfHeight.value = boxHeight / 2
    // Only re-derive when the photo (and its saved box) actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialBox?.id,
    imgNaturalWidth,
    imgNaturalHeight,
    canvasWidth,
    canvasHeight,
  ])

  // ── Notify the screen when crossing the zoomed-in threshold (for the carousel) ──
  useAnimatedReaction(
    () => userScale.value > ZOOM_REACTIVE_THRESHOLD,
    (zoomedIn, prev) => {
      if (zoomedIn !== prev && onZoomChange) runOnJS(onZoomChange)(zoomedIn)
    },
  )

  // ── Compute the confirmed box from the current transform ───────────────────
  const handleConfirm = useCallback(() => {
    if (!imgNaturalWidth || !imgNaturalHeight) return

    const scale = userScale.value
    const translateX = userTranslateX.value
    const translateY = userTranslateY.value

    const baseScale = Math.min(
      canvasWidth / imgNaturalWidth,
      canvasHeight / imgNaturalHeight,
    )
    const baseOffsetX = (canvasWidth - imgNaturalWidth * baseScale) / 2
    const baseOffsetY = (canvasHeight - imgNaturalHeight * baseScale) / 2
    const canvasCenterX = canvasWidth / 2
    const canvasCenterY = canvasHeight / 2
    const boxWidth = boxHalfWidth.value * 2
    const boxHeight = boxHalfHeight.value * 2
    const boxX = (canvasWidth - boxWidth) / 2
    const boxY = (canvasHeight - boxHeight) / 2

    const toImagePx = (cx: number, cy: number) => [
      ((cx - canvasCenterX - translateX) / scale +
        canvasCenterX -
        baseOffsetX) /
        baseScale,
      ((cy - canvasCenterY - translateY) / scale +
        canvasCenterY -
        baseOffsetY) /
        baseScale,
    ]

    const [x1, y1] = toImagePx(boxX, boxY)
    const [x2, y2] = toImagePx(boxX + boxWidth, boxY + boxHeight)

    const clampX = (v: number) => Math.min(Math.max(v, 0), imgNaturalWidth)
    const clampY = (v: number) => Math.min(Math.max(v, 0), imgNaturalHeight)

    onConfirm({
      lowerLeftX: clampX(x1) / imgNaturalWidth,
      lowerLeftY: clampY(y2) / imgNaturalHeight,
      upperRightX: clampX(x2) / imgNaturalWidth,
      upperRightY: clampY(y1) / imgNaturalHeight,
    })
  }, [
    canvasWidth,
    canvasHeight,
    imgNaturalWidth,
    imgNaturalHeight,
    onConfirm,
    userScale,
    userTranslateX,
    userTranslateY,
    boxHalfWidth,
    boxHalfHeight,
  ])

  // ── Pinch + pan + double-tap on the photo ───────────────────────────────────
  // Contain-fit half-extent of the image at scale=1 (see the clamp-math
  // comment above) — recomputed every render from current props, closed
  // over by the worklets below the same way MIN_SCALE etc. already are.
  const baseScale =
    imgNaturalWidth && imgNaturalHeight
      ? Math.min(canvasWidth / imgNaturalWidth, canvasHeight / imgNaturalHeight)
      : 0
  const halfExtentX = halfExtentOnScreen(imgNaturalWidth, baseScale)
  const halfExtentY = halfExtentOnScreen(imgNaturalHeight, baseScale)

  const pinch = Gesture.Pinch()
    .onStart(() => {
      'worklet'
      savedScale.value = userScale.value
    })
    .onUpdate((e) => {
      'worklet'
      const nextScale = Math.min(
        Math.max(savedScale.value * e.scale, MIN_SCALE),
        MAX_SCALE,
      )
      userScale.value = nextScale
      // Zooming out shrinks the valid translate range — an already-panned-
      // to-the-limit photo would otherwise go out of bounds mid-pinch.
      if (halfExtentX > 0 && halfExtentY > 0) {
        userTranslateX.value = clampTranslate(
          userTranslateX.value,
          maxTranslateForScale(halfExtentX, nextScale),
        )
        userTranslateY.value = clampTranslate(
          userTranslateY.value,
          maxTranslateForScale(halfExtentY, nextScale),
        )
        // Zooming out also shrinks how big the box can be without
        // overhanging the photo — re-clamp it the same way (#286).
        boxHalfWidth.value = clampHalfExtent(
          boxHalfWidth.value,
          MIN_HALF_EXTENT,
          maxHalfExtentForBox(canvasWidth / 2, halfExtentX, nextScale),
        )
        boxHalfHeight.value = clampHalfExtent(
          boxHalfHeight.value,
          MIN_HALF_EXTENT,
          maxHalfExtentForBox(canvasHeight / 2, halfExtentY, nextScale),
        )
      }
    })
    .onEnd(() => {
      'worklet'
      if (Math.abs(userScale.value - 1) < SNAP_THRESHOLD) {
        userScale.value = withSpring(1)
        userTranslateX.value = withSpring(0)
        userTranslateY.value = withSpring(0)
      }
    })

  const pan = Gesture.Pan()
    .onStart(() => {
      'worklet'
      savedTranslateX.value = userTranslateX.value
      savedTranslateY.value = userTranslateY.value
    })
    .onUpdate((e) => {
      'worklet'
      const nextX = savedTranslateX.value + e.translationX
      const nextY = savedTranslateY.value + e.translationY
      if (halfExtentX > 0 && halfExtentY > 0) {
        userTranslateX.value = clampTranslate(
          nextX,
          maxTranslateForScale(halfExtentX, userScale.value),
        )
        userTranslateY.value = clampTranslate(
          nextY,
          maxTranslateForScale(halfExtentY, userScale.value),
        )
      } else {
        userTranslateX.value = nextX
        userTranslateY.value = nextY
      }
    })
    .onEnd((e) => {
      'worklet'
      // #204: fast upward flick, not zoomed in, skips this photo — velocity-
      // gated so it doesn't compete with a slow deliberate drag. The
      // translationY floor rules out a fast double-tap's small pan updates
      // (photoGesture runs pan and doubleTap Simultaneous, so a tap's
      // release can carry nonzero velocity without the finger having
      // actually moved far).
      if (
        onNotInPhoto &&
        userScale.value <= ZOOM_REACTIVE_THRESHOLD &&
        e.translationY < -40 &&
        e.velocityY < -NOT_IN_PHOTO_SWIPE_VELOCITY
      ) {
        runOnJS(onNotInPhoto)()
      }
    })

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      'worklet'
      const next = userScale.value > 1 ? 1 : DOUBLE_TAP_SCALE
      userScale.value = withTiming(next)
      userTranslateX.value = withTiming(0)
      userTranslateY.value = withTiming(0)
    })

  // ── Edge handles: single-finger drag reshapes the box (#286) ───────────────
  // Each handle only ever touches its own axis; the opposite edge mirrors
  // automatically since both are drawn from the same half-extent.
  const leftHandle = Gesture.Pan()
    .onStart(() => {
      'worklet'
      savedBoxHalfWidth.value = boxHalfWidth.value
    })
    .onUpdate((e) => {
      'worklet'
      const maxHalf = maxHalfExtentForBox(
        canvasWidth / 2,
        halfExtentX,
        userScale.value,
      )
      const next = clampHalfExtent(
        savedBoxHalfWidth.value - e.translationX,
        MIN_HALF_EXTENT,
        maxHalf,
      )
      boxHalfWidth.value = clampAspectRatio(
        next,
        boxHalfHeight.value,
        MAX_ASPECT_RATIO,
      )
    })

  const rightHandle = Gesture.Pan()
    .onStart(() => {
      'worklet'
      savedBoxHalfWidth.value = boxHalfWidth.value
    })
    .onUpdate((e) => {
      'worklet'
      const maxHalf = maxHalfExtentForBox(
        canvasWidth / 2,
        halfExtentX,
        userScale.value,
      )
      const next = clampHalfExtent(
        savedBoxHalfWidth.value + e.translationX,
        MIN_HALF_EXTENT,
        maxHalf,
      )
      boxHalfWidth.value = clampAspectRatio(
        next,
        boxHalfHeight.value,
        MAX_ASPECT_RATIO,
      )
    })

  const topHandle = Gesture.Pan()
    .onStart(() => {
      'worklet'
      savedBoxHalfHeight.value = boxHalfHeight.value
    })
    .onUpdate((e) => {
      'worklet'
      const maxHalf = maxHalfExtentForBox(
        canvasHeight / 2,
        halfExtentY,
        userScale.value,
      )
      const next = clampHalfExtent(
        savedBoxHalfHeight.value - e.translationY,
        MIN_HALF_EXTENT,
        maxHalf,
      )
      boxHalfHeight.value = clampAspectRatio(
        next,
        boxHalfWidth.value,
        MAX_ASPECT_RATIO,
      )
    })

  const bottomHandle = Gesture.Pan()
    .onStart(() => {
      'worklet'
      savedBoxHalfHeight.value = boxHalfHeight.value
    })
    .onUpdate((e) => {
      'worklet'
      const maxHalf = maxHalfExtentForBox(
        canvasHeight / 2,
        halfExtentY,
        userScale.value,
      )
      const next = clampHalfExtent(
        savedBoxHalfHeight.value + e.translationY,
        MIN_HALF_EXTENT,
        maxHalf,
      )
      boxHalfHeight.value = clampAspectRatio(
        next,
        boxHalfWidth.value,
        MAX_ASPECT_RATIO,
      )
    })

  // A handle drag must win over the photo's own pan — otherwise the photo
  // slides underneath the finger at the same time the box reshapes.
  pan.blocksExternalGesture(leftHandle, rightHandle, topHandle, bottomHandle)

  const photoGesture = Gesture.Simultaneous(pinch, pan, doubleTap)

  // ── Long-press the center dot to confirm ────────────────────────────────────
  const dotGesture = Gesture.LongPress()
    .minDuration(HOLD_DURATION_MS)
    .onStart(() => {
      'worklet'
      holdProgress.value = withTiming(1, { duration: HOLD_DURATION_MS })
    })
    .onEnd((_e, success) => {
      'worklet'
      if (success) runOnJS(handleConfirm)()
    })
    .onFinalize((_e, success) => {
      'worklet'
      if (!success) holdProgress.value = withTiming(0, { duration: 120 })
    })

  return {
    photoGesture,
    dotGesture,
    leftHandleGesture: leftHandle,
    rightHandleGesture: rightHandle,
    topHandleGesture: topHandle,
    bottomHandleGesture: bottomHandle,
    userScale,
    userTranslateX,
    userTranslateY,
    boxHalfWidth,
    boxHalfHeight,
    holdProgress,
    confirmNow: handleConfirm,
  }
}

export const DOT_HITBOX_SIZE = DOT_HITBOX_RADIUS * 2
export const HANDLE_HITBOX_SIZE = HANDLE_HITBOX_RADIUS * 2
export { HANDLE_INSET }
