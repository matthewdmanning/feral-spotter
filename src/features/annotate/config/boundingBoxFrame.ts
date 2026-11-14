/**
 * features/annotate/config/boundingBoxFrame.ts
 * Tunables for the annotate crop frame (useBoundingBoxFrame) and its
 * on-screen hitboxes (AnnotateCarouselItem). Sizes are dp (canvas units).
 */

// ─── Photo zoom ─────────────────────────────────────────────────────────────
export const MIN_SCALE = 0.5
// The box has a fixed on-screen floor (MIN_HALF_EXTENT), so max zoom sets the
// smallest photo region it can frame — distant cats need a high ceiling.
export const MAX_SCALE = 8
export const SNAP_THRESHOLD = 0.08 // zoom-out snap-to-1 band
export const DOUBLE_TAP_SCALE = 2.5
export const ZOOM_REACTIVE_THRESHOLD = 1.02 // above this, treat as "zoomed in"

// ─── Confirm hold ───────────────────────────────────────────────────────────
export const HOLD_DURATION_MS = 650 // push time length
export const HOLD_CANCEL_DURATION_MS = 120 // hold-ring reset after an early release
export const HOLD_DOT_PULSE_SCALE = 1.4 // center dot grows to this while held
export const HOLD_DOT_PULSE_OPACITY = 0.6 // center dot fades to this while held

// ─── Hitboxes ───────────────────────────────────────────────────────────────
export const DOT_HITBOX_RADIUS = 24 // button hitbox radius
export const HANDLE_HITBOX_RADIUS = 36 // edge-handle hitbox radius (+50%, punchlist 2026-08-19)
export const DOT_HITBOX_SIZE = DOT_HITBOX_RADIUS * 2
export const HANDLE_HITBOX_SIZE = HANDLE_HITBOX_RADIUS * 2
// How far inward from the box edge the handles sit, on the crosshairs
// instead of straddling the border (#286 follow-up).
export const HANDLE_INSET = 20

// ─── Box size ───────────────────────────────────────────────────────────────
// Must clear the dot's own hitbox at minimum box size, or handle-drag and
// confirm-hold compete for the same pixels at dead center. HANDLE_INSET
// shifts handles toward center, so the margin has to grow with it.
export const MIN_HALF_EXTENT =
  DOT_HITBOX_RADIUS + HANDLE_HITBOX_RADIUS + HANDLE_INSET
// Ceiling on MIN_HALF_EXTENT / MAX_SCALE: the smallest box half-extent, in
// dp at fit zoom, that a fully zoomed-in user can frame. Regression guard for
// distant-cat framing — the current shipped value, not a measured target.
export const MAX_MIN_FRAMED_HALF_EXTENT = 10
export const MAX_ASPECT_RATIO = 3 // widest/tallest the box can go, either axis
export const DEFAULT_BOX_FRACTION = 0.85 // initial box size, as a fraction of the shorter canvas axis
export const A11Y_RESIZE_STEP = 8 // screen-reader grow/shrink step, per side

// ─── #204: swipe-up-to-"Not in Photo" ───────────────────────────────────────
// Needs on-device tuning — a starting point, not a measured value. Gated on
// not-zoomed-in so a fast upward flick while framing a zoomed photo doesn't
// get misread as the skip gesture.
export const NOT_IN_PHOTO_SWIPE_VELOCITY = 800 // dp/sec, upward (negative velocityY)
// Minimum upward travel, so a fast double-tap's small pan updates don't count.
export const NOT_IN_PHOTO_SWIPE_MIN_DISTANCE = 40 // upward
