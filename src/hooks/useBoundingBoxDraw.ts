/**
 * hooks/useBoundingBoxDraw.ts
 *
 * Manages drawing a bounding box on a single Skia Canvas:
 *   - Pan gesture (GestureDetector) tracks start + current coordinates
 *   - Reanimated SharedValues drive the live-rect in the canvas (UI thread)
 *   - On gesture end: normalise → call onSave → reset
 *
 * Requires react-native-skia v1.x (Reanimated SharedValues as Skia props).
 */

import type { BoundingBox } from "@/src/types/BoundingBox";
import { useCallback } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  runOnJS,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";

// Minimum drag size to register as a box (avoids accidental taps)
const MIN_SIZE_PX = 10;

interface UseBoundingBoxDrawParams {
  canvasWidth: number;
  canvasHeight: number;
  catId: string;
  photoId: string;
  onSave: (box: Omit<BoundingBox, "id" | "cat_id" | "photo_local_id">) => void;
}

export interface BoundingBoxDrawResult {
  /** Attach to GestureDetector wrapping the Canvas */
  panGesture: ReturnType<typeof Gesture.Pan>;
  /** Live rect coordinates — pass directly to Skia <Rect> props */
  liveX: ReturnType<typeof useDerivedValue>;
  liveY: ReturnType<typeof useDerivedValue>;
  liveW: ReturnType<typeof useDerivedValue>;
  liveH: ReturnType<typeof useDerivedValue>;
}

export function useBoundingBoxDraw({
  canvasWidth,
  canvasHeight,
  catId,
  photoId,
  onSave,
}: UseBoundingBoxDrawParams): BoundingBoxDrawResult {
  // Track raw pixel coordinates on the UI thread
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const curX = useSharedValue(0);
  const curY = useSharedValue(0);
  const active = useSharedValue(false);

  // ── Derived Skia-compatible values (run on UI thread) ─────────────────────
  // Width/height are 0 when not drawing so nothing is visible at rest.
  const liveX = useDerivedValue(() => Math.min(startX.value, curX.value));
  const liveY = useDerivedValue(() => Math.min(startY.value, curY.value));
  const liveW = useDerivedValue(() =>
    active.value ? Math.abs(curX.value - startX.value) : 0,
  );
  const liveH = useDerivedValue(() =>
    active.value ? Math.abs(curY.value - startY.value) : 0,
  );

  // ── Save callback (JS thread) ─────────────────────────────────────────────
  const save = useCallback(
    (sx: number, sy: number, ex: number, ey: number) => {
      const pxW = Math.abs(ex - sx);
      const pxH = Math.abs(ey - sy);
      if (pxW < MIN_SIZE_PX || pxH < MIN_SIZE_PX) return; // ignore taps

      onSave({
        x: Math.min(sx, ex) / canvasWidth,
        y: Math.min(sy, ey) / canvasHeight,
        width: pxW / canvasWidth,
        height: pxH / canvasHeight,
      });
    },
    [canvasWidth, canvasHeight, onSave],
  );

  // ── Pan gesture (UI thread worklet) ───────────────────────────────────────
  const panGesture = Gesture.Pan()
    .onStart((e) => {
      "worklet";
      startX.value = e.x;
      startY.value = e.y;
      curX.value = e.x;
      curY.value = e.y;
      active.value = true;
    })
    .onUpdate((e) => {
      "worklet";
      curX.value = e.x;
      curY.value = e.y;
    })
    .onEnd(() => {
      "worklet";
      runOnJS(save)(startX.value, startY.value, curX.value, curY.value);
      active.value = false;
      // Reset coords so no stale rect flickers on next mount
      startX.value = 0;
      startY.value = 0;
      curX.value = 0;
      curY.value = 0;
    })
    .onFinalize(() => {
      "worklet";
      active.value = false;
    });

  return { panGesture, liveX, liveY, liveW, liveH };
}
