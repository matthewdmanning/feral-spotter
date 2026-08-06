/**
 * components/organisms/InsetCropBubble.tsx
 *
 * Floating circular "docked bubble" inset crop (#174, design decided in
 * #168 as Variant B). Renders on both `annotate` (bottom-right) and Cat
 * Form (top-right, inside its header zone) — same component, different
 * edge. Reuses #172's box-lookup/crop-centering seam unchanged; only the
 * container shape, sizing, positioning, and collapse behavior are new.
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
import { computeBubbleDiameter } from '@/src/lib/insetCrop/diameter'
import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import { Animated, Dimensions, Pressable } from 'react-native'
import { styles } from './InsetCropBubble.styles'

const window = Dimensions.get('window')

// Matches the #168 prototype's `--bubble-d` fallback — used for a
// degenerate (zero-area) box, and as the pre-report default a host layout
// (Cat Form's header zone) reserves before any bubble has confirmed a size.
export const DEFAULT_DIAMETER = 68
// #168 decided: translateX(62%) toward the anchoring edge, fixed diameter.
const COLLAPSE_SLIDE_FRACTION = 0.62

export type InsetCropEdge = 'top-right' | 'bottom-right'

interface InsetCropBubbleProps {
  catId: string
  edge: InsetCropEdge
  /** Reports the live computed diameter so a host layout (Cat Form's header zone) can reserve space for it. */
  onDiameterChange?: (diameter: number) => void
}

export function InsetCropBubble({
  catId,
  edge,
  onDiameterChange,
}: InsetCropBubbleProps) {
  const getFirstBox = useBoundingBoxStore((s) => s.getFirstBox)
  const photos = usePhotoStore((s) => s.photos)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [collapsed, setCollapsed] = useState(false)
  // useState (not useRef) for the stable Animated.Value — reading `.current`
  // during render trips this repo's `react-hooks/refs` lint rule.
  const [slideAnim] = useState(() => new Animated.Value(0))

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

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: collapsed ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start()
  }, [collapsed, slideAnim])

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

  return (
    <Animated.View
      style={[
        styles.wrap,
        edge === 'top-right' ? styles.wrapTopRight : styles.wrapBottomRight,
        {
          transform: [
            {
              translateX: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, diameter * COLLAPSE_SLIDE_FRACTION],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        testID="inset-crop-bubble"
        onPress={() => setCollapsed((c) => !c)}
        style={[
          styles.bubble,
          { width: diameter, height: diameter, borderRadius: diameter / 2 },
        ]}
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
