/**
 * components/organisms/InsetCropBubble.tsx
 *
 * Floating "docked bubble" inset crop (#174, design decided in #168 as
 * Variant B). Renders on both `annotate` (top-right) and Cat Form
 * (top-center, inside its header zone) — same component, same collapse
 * behavior, different edge. Reuses #172's box-lookup/crop-centering seam
 * unchanged; only the container shape, sizing, positioning, and collapse
 * behavior are new.
 *
 * Rounded square, not #168's circular pill (#186 regression fix) — the
 * circle read as visually heavier than intended and gave no clean way to
 * signal the Cat Form title fading beneath it the way a squared-off edge
 * does.
 *
 * Collapse is unified across both screens (2026-08-07, superseding #168's
 * per-screen edge-ward-slide-only spec): both dock toward the right screen
 * edge and shrink to a flat `COLLAPSED_DIAMETER`. `top-center` has no
 * anchoring side edge by default, so its wrap is right-anchored like
 * `top-right` and centered *while expanded* via a computed translateX,
 * animating back to the anchor on collapse — see
 * `docs/design-decisions/inset-crop-bubble.md`. Defaults to collapsed on
 * mount (#202) — both screens land with a docked bubble, not one already
 * covering the frame.
 *
 * Unit note (deviation from #174's literal spec text, flagged on the
 * issue): the ticket says diameter should come from the box's
 * natural-image pixel dimensions. Fed literally into the diameter
 * formula, a modest box on a real camera photo (e.g. 25%x20% of a
 * 4032x3024 photo, ~1000x600px) computes an ~800dp bubble — unusable, and
 * inconsistent with #174's own "can compute below the 44-48dp touch
 * target" concern, which only makes sense at display scale. The #168
 * prototype's own mock inputs (40-170px against a 267px mock device
 * frame) confirm display scale was the intent. Using the device window's
 * *width* as the reference for both box axes (not width for one axis and
 * height for the other) reproduces the prototype's proportions while
 * staying isotropic — scaling each axis by a different screen dimension
 * would stretch the box's aspect ratio before it reaches a formula that's
 * sensitive to that ratio (min-side + diagonal).
 */

import { usePhotoStore } from '@/src/hooks'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { computeCollapsedOffset } from '@/src/lib/insetCrop/collapse'
import { computeBubbleDiameter } from '@/src/lib/insetCrop/diameter'
import { Image } from 'expo-image'
import { useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, Pressable } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './InsetCropBubble.styles'

const window = Dimensions.get('window')

// Matches the #168 prototype's `--bubble-d` fallback — used for a
// degenerate (zero-area) box, and as the pre-report default a host layout
// (Cat Form's header zone) reserves before any bubble has confirmed a size.
export const DEFAULT_DIAMETER = 68
// Flat collapsed size (2026-08-07), not proportional to the expanded
// diameter — deliberate deviation from #168's prototype-documented
// scale(0.4) shrink-fallback. Same numeric value as DEFAULT_DIAMETER, but
// an independently tunable constant — different semantic role (a
// not-yet-confirmed-box placeholder vs. a collapsed-state target size).
export const COLLAPSED_DIAMETER = 68
const COLLAPSE_DURATION_MS = 220

export type InsetCropEdge = 'top-center' | 'top-right'

interface InsetCropBubbleProps {
  catId: string
  edge: InsetCropEdge
  /** Reports the live computed diameter so a host layout (Cat Form's header zone) can reserve space for it. */
  onDiameterChange?: (diameter: number) => void
  /**
   * Reports collapsed state eagerly on expand, delayed (until the slide
   * finishes) on collapse — for a host layout (Cat Form's header zone) that
   * must never shrink its reservation while the bubble could still overlap
   * it, but is safe to grow early. Not the same signal a title fade should
   * use — see `onSettledChange`.
   */
  onCollapsedChange?: (collapsed: boolean) => void
  /**
   * Reports collapsed state only once the slide has actually finished, in
   * *both* directions — for a host that wants "is the bubble actually
   * covering me right now" (e.g. Cat Form's title fade: fades only once
   * expanded and positioned over it, un-fades only once collapsed and
   * docked — docs/design-decisions/inset-crop-bubble.md). Reporting the
   * expand direction eagerly here (like `onCollapsedChange` does) would
   * fade the title before the bubble has actually slid into place over it.
   */
  onSettledChange?: (collapsed: boolean) => void
}

export function InsetCropBubble({
  catId,
  edge,
  onDiameterChange,
  onCollapsedChange,
  onSettledChange,
}: InsetCropBubbleProps) {
  const { theme } = useUnistyles()
  const getFirstBox = useBoundingBoxStore((s) => s.getFirstBox)
  const photos = usePhotoStore((s) => s.photos)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  // Collapsed by default (#202) — both screens land with the bubble docked
  // at the edge, not already covering the photo/title.
  const [collapsed, setCollapsed] = useState(true)
  // useState (not useRef) for the stable Animated.Value — reading `.current`
  // during render trips this repo's `react-hooks/refs` lint rule.
  const [slideAnim] = useState(() => new Animated.Value(1))
  const hasMounted = useRef(false)
  const hasSettledMounted = useRef(false)

  const box = getFirstBox(catId)
  const photo = box
    ? photos.find((p) => p.local_id === box.photo_local_id)
    : undefined

  // Both axes scaled by window.width (not width for one axis, height for
  // the other) — an isotropic reference, so the box's aspect ratio survives
  // into a formula that's sensitive to it (min-side + diagonal).
  const boxWidthDp = box ? (box.upperRightX - box.lowerLeftX) * window.width : 0
  const boxHeightDp = box
    ? (box.lowerLeftY - box.upperRightY) * window.width
    : 0
  const diameter =
    boxWidthDp > 0 && boxHeightDp > 0
      ? computeBubbleDiameter(boxWidthDp, boxHeightDp)
      : DEFAULT_DIAMETER

  useEffect(() => {
    if (box && photo) onDiameterChange?.(diameter)
  }, [diameter, box, photo, onDiameterChange])

  // Drives the visual slide/scale only — fire-and-forget, independent of
  // when (or whether) the host is told about it below. Runs even on the
  // initial mount, but from-1-to-1 is a no-op since collapsed defaults true.
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: collapsed ? 1 : 0,
      duration: COLLAPSE_DURATION_MS,
      useNativeDriver: true,
    }).start()
  }, [collapsed, slideAnim])

  // Reports collapsed state to the host at the right moment (#202): a host
  // layout (Cat Form's header zone) uses this to shrink its reservation, and
  // must never shrink while the bubble could still overlap the title — so
  // "becoming collapsed" is only reported once the slide animation has had
  // time to finish, not at the tap that starts it. A plain timer matching
  // the animation's own duration, not the Animated completion callback —
  // decouples the signal from Animated's timing internals, which are hard
  // to drive deterministically in tests. "Becoming expanded" is reported
  // immediately instead: over-reserving space early is safe, only shrinking
  // early is not. The initial mount (already collapsed by default) reports
  // synchronously too — there's no animation to wait for when there was
  // nothing expanded to begin with.
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      onCollapsedChange?.(collapsed)
      return
    }
    if (!collapsed) {
      onCollapsedChange?.(false)
      return
    }
    const timer = setTimeout(() => {
      onCollapsedChange?.(true)
    }, COLLAPSE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [collapsed, onCollapsedChange])

  // Symmetric version of the above for onSettledChange — delayed in both
  // directions, since a title fade needs "actually covering" rather than
  // "started moving toward." The initial mount reports immediately (no
  // animation happened, already settled).
  useEffect(() => {
    if (!hasSettledMounted.current) {
      hasSettledMounted.current = true
      onSettledChange?.(collapsed)
      return
    }
    const timer = setTimeout(() => {
      onSettledChange?.(collapsed)
    }, COLLAPSE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [collapsed, onSettledChange])

  // No box confirmed yet for this cat (story 2) — nothing to anchor on.
  if (!box || !photo) return null

  let imageStyle = { width: diameter, height: diameter, left: 0, top: 0 }
  if (natural.w > 0 && natural.h > 0) {
    const boxCenterX = (box.lowerLeftX + box.upperRightX) / 2
    const boxCenterY = (box.lowerLeftY + box.upperRightY) / 2
    const boxWidthPx = (box.upperRightX - box.lowerLeftX) * natural.w
    const boxHeightPx = (box.lowerLeftY - box.upperRightY) * natural.h
    // A degenerate (zero-area) box would divide by zero — fall back to
    // showing the full frame around the box's center instead of NaN styles.
    const scale =
      boxWidthPx > 0 && boxHeightPx > 0
        ? Math.max(diameter / boxWidthPx, diameter / boxHeightPx)
        : Math.min(diameter / natural.w, diameter / natural.h)
    const imgWidth = natural.w * scale
    const imgHeight = natural.h * scale
    imageStyle = {
      width: imgWidth,
      height: imgHeight,
      left: diameter / 2 - boxCenterX * imgWidth,
      top: diameter / 2 - boxCenterY * imgHeight,
    }
  }

  // top-center's wrap is right-anchored (styles.wrapTopCenter), same as
  // top-right — so at the anchor (offset 0) it already sits flush at the
  // edge. To read as "centered" while expanded, it needs a leftward offset
  // pulling it in from that edge to the screen's horizontal center; both
  // edges then converge on the same collapsed offset, computed to land the
  // collapsed (scaled-down) bubble's visual edge back at the anchor rather
  // than short of it or past it off-screen (#202 — see
  // src/lib/insetCrop/collapse.ts).
  const centeringOffset =
    edge === 'top-center' ? theme.spacing.md - (window.width - diameter) / 2 : 0
  const collapsedOffset = computeCollapsedOffset(diameter, COLLAPSED_DIAMETER)
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [centeringOffset, collapsedOffset],
  })
  const scale = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, COLLAPSED_DIAMETER / diameter],
  })
  const collapseTransform = [{ translateX }, { scale }]

  return (
    <Animated.View
      style={[
        styles.wrap,
        edge === 'top-center' ? styles.wrapTopCenter : styles.wrapTopRight,
        { transform: collapseTransform },
      ]}
    >
      <Pressable
        testID="inset-crop-bubble"
        onPress={() => setCollapsed((c) => !c)}
        style={[styles.bubble, { width: diameter, height: diameter }]}
        accessibilityRole="button"
        accessibilityLabel={
          collapsed ? 'Expand cat photo preview' : 'Collapse cat photo preview'
        }
      >
        <Image
          source={{ uri: photo.uri }}
          cachePolicy="memory-disk"
          style={[styles.image, imageStyle]}
          contentFit="cover"
          onLoad={(e) => setNatural({ w: e.source.width, h: e.source.height })}
          accessibilityLabel="Cropped photo of the cat being described"
        />
      </Pressable>
    </Animated.View>
  )
}
