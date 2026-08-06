/**
 * components/organisms/CatFormInsetCrop.tsx
 *
 * Ticket #172 placeholder: a plain, undesigned static crop of the cat's
 * first confirmed box, persisted from `annotate` onto Cat Form. Wiring only
 * — no pop-out/slide-to-side interaction. That's ticket #174, gated on the
 * visual/interaction design in wayfinder #168.
 *
 * "Static" per ADR 0004: computed once from the box's natural-image pixel
 * dimensions on load, never recomputed afterward.
 */

import { usePhotoStore } from '@/src/hooks'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { Image } from 'expo-image'
import { useState } from 'react'
import { View } from 'react-native'
import { styles } from './CatFormInsetCrop.styles'

const SIZE = 88

interface CatFormInsetCropProps {
  catId: string
}

export function CatFormInsetCrop({ catId }: CatFormInsetCropProps) {
  const getFirstBox = useBoundingBoxStore((s) => s.getFirstBox)
  const photos = usePhotoStore((s) => s.photos)
  const [natural, setNatural] = useState({ w: 0, h: 0 })

  const box = getFirstBox(catId)
  const photo = box
    ? photos.find((p) => p.local_id === box.photo_local_id)
    : undefined

  if (!box || !photo) return null

  let imageStyle = { width: SIZE, height: SIZE, left: 0, top: 0 }
  if (natural.w > 0 && natural.h > 0) {
    const boxCenterX = (box.lowerLeftX + box.upperRightX) / 2
    const boxCenterY = (box.lowerLeftY + box.upperRightY) / 2
    const boxWidthPx = (box.upperRightX - box.lowerLeftX) * natural.w
    const boxHeightPx = (box.lowerLeftY - box.upperRightY) * natural.h
    // A degenerate (zero-area) box would divide by zero — fall back to
    // showing the full frame around the box's center instead of NaN styles.
    const scale =
      boxWidthPx > 0 && boxHeightPx > 0
        ? Math.max(SIZE / boxWidthPx, SIZE / boxHeightPx)
        : Math.min(SIZE / natural.w, SIZE / natural.h)
    const imgWidth = natural.w * scale
    const imgHeight = natural.h * scale
    imageStyle = {
      width: imgWidth,
      height: imgHeight,
      left: SIZE / 2 - boxCenterX * imgWidth,
      top: SIZE / 2 - boxCenterY * imgHeight,
    }
  }

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: photo.uri }}
        cachePolicy="memory-disk"
        style={[styles.image, imageStyle]}
        contentFit="cover"
        onLoad={(e) => setNatural({ w: e.source.width, h: e.source.height })}
        accessibilityLabel="Cropped photo of the cat being described"
      />
    </View>
  )
}
