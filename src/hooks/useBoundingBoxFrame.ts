/**
 * hooks/useBoundingBoxFrame.ts
 *
 * Fixed-square crop frame: the square crosshair stays centered and fixed on
 * screen; the user pinches/pans/double-taps the photo underneath it to frame
 * the cat, then long-presses the center dot (or calls confirmNow() from a
 * button) to confirm. Confirming computes the square's projection onto the
 * original image as a normalised BoundingBox and hands it to onConfirm.
 *
 * Requires react-native-gesture-handler + react-native-reanimated v4
 * (Reanimated SharedValues, worklet gestures).
 */

import type { BoundingBox } from "@/src/types/BoundingBox";
import { useCallback, useEffect } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

// ─── Tunables ───────────────────────────────────────────────────────────────
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const SNAP_THRESHOLD = 0.08; // zoom-out snap-to-1 band
const DOUBLE_TAP_SCALE = 2.5;
const HOLD_DURATION_MS = 650; // push time length
const DOT_HITBOX_RADIUS = 24; // button hitbox radius
const ZOOM_REACTIVE_THRESHOLD = 1.02; // above this, treat as "zoomed in"

export const BOUNDING_BOX_FRAME_TUNABLES = {
  MIN_SCALE, MAX_SCALE, SNAP_THRESHOLD, DOUBLE_TAP_SCALE,
  HOLD_DURATION_MS, DOT_HITBOX_RADIUS, ZOOM_REACTIVE_THRESHOLD,
};

interface UseBoundingBoxFrameParams {
  canvasWidth: number;
  canvasHeight: number;
  imgNaturalWidth: number;
  imgNaturalHeight: number;
  initialBox?: BoundingBox;
  onConfirm: (box: Omit<BoundingBox, "id" | "cat_id" | "photo_local_id">) => void;
  /** Fires when the photo crosses the zoomed-in threshold, for disabling carousel swipe */
  onZoomChange?: (zoomedIn: boolean) => void;
}

export interface BoundingBoxFrameResult {
  /** Attach to the full-canvas GestureDetector wrapping the photo */
  photoGesture: ReturnType<typeof Gesture.Simultaneous>;
  /** Attach to the small centered dot's own GestureDetector — render it on top */
  dotGesture: ReturnType<typeof Gesture.LongPress>;
  userScale: ReturnType<typeof useSharedValue<number>>;
  userTranslateX: ReturnType<typeof useSharedValue<number>>;
  userTranslateY: ReturnType<typeof useSharedValue<number>>;
  /** 0->1 while the dot is held, for motion-only feedback (scale/opacity) */
  holdProgress: ReturnType<typeof useSharedValue<number>>;
  /** Same effect as a successful long-press — call from a Confirm button */
  confirmNow: () => void;
}

export function useBoundingBoxFrame({
  canvasWidth,
  canvasHeight,
  imgNaturalWidth,
  imgNaturalHeight,
  initialBox,
  onConfirm,
  onZoomChange,
}: UseBoundingBoxFrameParams): BoundingBoxFrameResult {
  const userScale = useSharedValue(1);
  const userTranslateX = useSharedValue(0);
  const userTranslateY = useSharedValue(0);
  const holdProgress = useSharedValue(0);

  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // ── Resume a previously-confirmed photo: reconstruct the transform that
  // produced the saved box, instead of resetting to identity. ────────────────
  useEffect(() => {
    if (!initialBox || !imgNaturalWidth || !imgNaturalHeight) return;

    const baseScale = Math.min(canvasWidth / imgNaturalWidth, canvasHeight / imgNaturalHeight);
    const baseOffsetX = (canvasWidth - imgNaturalWidth * baseScale) / 2;
    const baseOffsetY = (canvasHeight - imgNaturalHeight * baseScale) / 2;
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;
    const squareSize = Math.min(canvasWidth, canvasHeight);

    const cx1 = baseOffsetX + initialBox.lowerLeftX * imgNaturalWidth * baseScale;
    const cx2 = baseOffsetX + initialBox.upperRightX * imgNaturalWidth * baseScale;
    const cy1 = baseOffsetY + initialBox.upperRightY * imgNaturalHeight * baseScale;
    const cy2 = baseOffsetY + initialBox.lowerLeftY * imgNaturalHeight * baseScale;

    const boxScreenSize = cx2 - cx1;
    if (boxScreenSize <= 0) return;

    const scale = squareSize / boxScreenSize;
    const translateX = (canvasCenterX - (cx1 + cx2) / 2) * scale;
    const translateY = (canvasCenterY - (cy1 + cy2) / 2) * scale;

    userScale.value = scale;
    userTranslateX.value = translateX;
    userTranslateY.value = translateY;
    savedScale.value = scale;
    savedTranslateX.value = translateX;
    savedTranslateY.value = translateY;
    // Only re-derive when the photo (and its saved box) actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBox?.id, imgNaturalWidth, imgNaturalHeight, canvasWidth, canvasHeight]);

  // ── Notify the screen when crossing the zoomed-in threshold (for the carousel) ──
  useAnimatedReaction(
    () => userScale.value > ZOOM_REACTIVE_THRESHOLD,
    (zoomedIn, prev) => {
      if (zoomedIn !== prev && onZoomChange) runOnJS(onZoomChange)(zoomedIn);
    },
  );

  // ── Compute the confirmed box from the current transform ───────────────────
  const handleConfirm = useCallback(() => {
    if (!imgNaturalWidth || !imgNaturalHeight) return;

    const scale = userScale.value;
    const translateX = userTranslateX.value;
    const translateY = userTranslateY.value;

    const baseScale = Math.min(canvasWidth / imgNaturalWidth, canvasHeight / imgNaturalHeight);
    const baseOffsetX = (canvasWidth - imgNaturalWidth * baseScale) / 2;
    const baseOffsetY = (canvasHeight - imgNaturalHeight * baseScale) / 2;
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;
    const squareSize = Math.min(canvasWidth, canvasHeight);
    const squareX = (canvasWidth - squareSize) / 2;
    const squareY = (canvasHeight - squareSize) / 2;

    const toImagePx = (cx: number, cy: number) => [
      ((cx - canvasCenterX - translateX) / scale + canvasCenterX - baseOffsetX) / baseScale,
      ((cy - canvasCenterY - translateY) / scale + canvasCenterY - baseOffsetY) / baseScale,
    ];

    const [x1, y1] = toImagePx(squareX, squareY);
    const [x2, y2] = toImagePx(squareX + squareSize, squareY + squareSize);

    const clampX = (v: number) => Math.min(Math.max(v, 0), imgNaturalWidth);
    const clampY = (v: number) => Math.min(Math.max(v, 0), imgNaturalHeight);

    onConfirm({
      lowerLeftX: clampX(x1) / imgNaturalWidth,
      lowerLeftY: clampY(y2) / imgNaturalHeight,
      upperRightX: clampX(x2) / imgNaturalWidth,
      upperRightY: clampY(y1) / imgNaturalHeight,
    });
  }, [canvasWidth, canvasHeight, imgNaturalWidth, imgNaturalHeight, onConfirm, userScale, userTranslateX, userTranslateY]);

  // ── Pinch + pan + double-tap on the photo ───────────────────────────────────
  const pinch = Gesture.Pinch()
    .onStart(() => {
      "worklet";
      savedScale.value = userScale.value;
    })
    .onUpdate((e) => {
      "worklet";
      userScale.value = Math.min(Math.max(savedScale.value * e.scale, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      "worklet";
      if (Math.abs(userScale.value - 1) < SNAP_THRESHOLD) {
        userScale.value = withSpring(1);
        userTranslateX.value = withSpring(0);
        userTranslateY.value = withSpring(0);
      }
    });

  const pan = Gesture.Pan()
    .onStart(() => {
      "worklet";
      savedTranslateX.value = userTranslateX.value;
      savedTranslateY.value = userTranslateY.value;
    })
    .onUpdate((e) => {
      "worklet";
      userTranslateX.value = savedTranslateX.value + e.translationX;
      userTranslateY.value = savedTranslateY.value + e.translationY;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      "worklet";
      const next = userScale.value > 1 ? 1 : DOUBLE_TAP_SCALE;
      userScale.value = withTiming(next);
      userTranslateX.value = withTiming(0);
      userTranslateY.value = withTiming(0);
    });

  const photoGesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  // ── Long-press the center dot to confirm ────────────────────────────────────
  const dotGesture = Gesture.LongPress()
    .minDuration(HOLD_DURATION_MS)
    .onStart(() => {
      "worklet";
      holdProgress.value = withTiming(1, { duration: HOLD_DURATION_MS });
    })
    .onEnd((_e, success) => {
      "worklet";
      if (success) runOnJS(handleConfirm)();
    })
    .onFinalize((_e, success) => {
      "worklet";
      if (!success) holdProgress.value = withTiming(0, { duration: 120 });
    });

  return {
    photoGesture,
    dotGesture,
    userScale,
    userTranslateX,
    userTranslateY,
    holdProgress,
    confirmNow: handleConfirm,
  };
}

export const DOT_HITBOX_SIZE = DOT_HITBOX_RADIUS * 2;
