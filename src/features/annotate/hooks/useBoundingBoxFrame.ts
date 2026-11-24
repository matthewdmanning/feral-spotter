/**
 * features/annotate/hooks/useBoundingBoxFrame.ts
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
  DEFAULT_BOX_FRACTION,
  DOUBLE_TAP_SCALE,
  HOLD_CANCEL_DURATION_MS,
  HOLD_DURATION_MS,
  MAX_ASPECT_RATIO,
  MAX_SCALE,
  MIN_HALF_EXTENT,
  MIN_SCALE,
  NOT_IN_PHOTO_SWIPE_MIN_DISTANCE,
  NOT_IN_PHOTO_SWIPE_VELOCITY,
  SNAP_THRESHOLD,
  ZOOM_REACTIVE_THRESHOLD,
} from '@/src/features/annotate/config/boundingBoxFrame'
import {
  clampAspectRatio,
  clampHalfExtent,
  maxHalfExtentForBox,
} from '@/src/features/annotate/lib/boxResize'
import {
  boxForTransform,
  transformForBox,
} from '@/src/shared/lib/geometry/cropProjection'
import {
  clampTranslate,
  halfExtentOnScreen,
  maxTranslateForScale,
} from '@/src/features/annotate/lib/panClamp'
import type { BoundingBox } from '@/src/shared/types/BoundingBox'
import { useCallback, useEffect } from 'react'
import { Gesture } from 'react-native-gesture-handler'
import {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

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
  /**
   * Grows (positive) or shrinks (negative) one axis by `deltaHalf` dp per
   * side, with the same clamps as the handle drags. The screen-reader
   * alternative to dragging a handle.
   */
  resizeBy: (axis: 'width' | 'height', deltaHalf: number) => void
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

    const maxBoxDim = Math.min(canvasWidth, canvasHeight) * DEFAULT_BOX_FRACTION
    const transform = transformForBox(
      initialBox,
      { canvasWidth, canvasHeight, imgNaturalWidth, imgNaturalHeight },
      maxBoxDim,
    )
    if (!transform) return

    userScale.value = transform.scale
    userTranslateX.value = transform.translateX
    userTranslateY.value = transform.translateY
    savedScale.value = transform.scale
    savedTranslateX.value = transform.translateX
    savedTranslateY.value = transform.translateY
    boxHalfWidth.value = transform.boxHalfWidth
    boxHalfHeight.value = transform.boxHalfHeight
    savedBoxHalfWidth.value = transform.boxHalfWidth
    savedBoxHalfHeight.value = transform.boxHalfHeight
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

    onConfirm(
      boxForTransform(
        {
          scale: userScale.value,
          translateX: userTranslateX.value,
          translateY: userTranslateY.value,
          boxHalfWidth: boxHalfWidth.value,
          boxHalfHeight: boxHalfHeight.value,
        },
        { canvasWidth, canvasHeight, imgNaturalWidth, imgNaturalHeight },
      ),
    )
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
        e.translationY < -NOT_IN_PHOTO_SWIPE_MIN_DISTANCE &&
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
  // One factory so the min, max and aspect limits hold from every edge.
  // `sign` is -1 for the left/top edge, where dragging outward is negative.
  const edgeHandle = (axis: 'x' | 'y', sign: 1 | -1) => {
    const own = axis === 'x' ? boxHalfWidth : boxHalfHeight
    const saved = axis === 'x' ? savedBoxHalfWidth : savedBoxHalfHeight
    const other = axis === 'x' ? boxHalfHeight : boxHalfWidth
    const canvasHalf = (axis === 'x' ? canvasWidth : canvasHeight) / 2
    const imageHalf = axis === 'x' ? halfExtentX : halfExtentY
    return Gesture.Pan()
      .onStart(() => {
        'worklet'
        saved.value = own.value
      })
      .onUpdate((e) => {
        'worklet'
        const maxHalf = maxHalfExtentForBox(
          canvasHalf,
          imageHalf,
          userScale.value,
        )
        const translation = axis === 'x' ? e.translationX : e.translationY
        const next = clampHalfExtent(
          saved.value + sign * translation,
          MIN_HALF_EXTENT,
          maxHalf,
        )
        own.value = clampAspectRatio(next, other.value, MAX_ASPECT_RATIO)
      })
  }

  const leftHandle = edgeHandle('x', -1)
  const rightHandle = edgeHandle('x', 1)
  const topHandle = edgeHandle('y', -1)
  const bottomHandle = edgeHandle('y', 1)

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
      if (!success) {
        holdProgress.value = withTiming(0, {
          duration: HOLD_CANCEL_DURATION_MS,
        })
      }
    })

  const resizeBy = (axis: 'width' | 'height', deltaHalf: number) => {
    const isWidth = axis === 'width'
    const current = isWidth ? boxHalfWidth : boxHalfHeight
    const other = isWidth ? boxHalfHeight : boxHalfWidth
    const maxHalf = maxHalfExtentForBox(
      (isWidth ? canvasWidth : canvasHeight) / 2,
      isWidth ? halfExtentX : halfExtentY,
      userScale.value,
    )
    current.value = clampAspectRatio(
      clampHalfExtent(current.value + deltaHalf, MIN_HALF_EXTENT, maxHalf),
      other.value,
      MAX_ASPECT_RATIO,
    )
  }

  return {
    resizeBy,
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
