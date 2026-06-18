/**
 * components/organisms/AnnotateCarouselItem.tsx
 *
 * Single slide in the annotation carousel.
 *
 * Layer order (z):
 *   1 (bottom) — expo-image, absoluteFill, contentFit contain, full-screen centred
 *   2 (top)    — Skia Canvas, absoluteFill over image only (constrained by parent View)
 *
 * The Canvas never extends to the Done/Back buttons because those
 * live outside this component in the screen's normal document flow.
 *
 * Theme colors are read via useUnistyles() because Skia's <Rect color>
 * is a component prop (not a style prop) — Unistyles cannot auto-update
 * it through the ShadowTree, so it must come from the theme object directly.
 *
 * Requires:
 *   @shopify/react-native-skia  v1.x  (Reanimated SharedValues as Skia props)
 *   react-native-gesture-handler
 *   expo-image
 */

import { useBoundingBoxDraw } from '@/src/hooks/useBoundingBoxDraw'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import type { SubmissionPhoto } from '@/src/types'
import { Canvas, Group, Paint, Rect } from '@shopify/react-native-skia'
import { useCallback } from 'react'
import { View } from 'react-native'
import { Image } from 'expo-image'
import { GestureDetector } from 'react-native-gesture-handler'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

interface AnnotateCarouselItemProps {
  photo: SubmissionPhoto
  catId: string
  /** Width of the carousel slide (= screen width) */
  width: number
  /** Height of the carousel slide (= available height between top bar and buttons) */
  height: number
}

export function AnnotateCarouselItem({
  photo, catId, width, height,
}: AnnotateCarouselItemProps) {
  const { theme } = useUnistyles()
  const addBox = useBoundingBoxStore((s) => s.addBox)
  const getBoxes = useBoundingBoxStore((s) => s.getBoxes)

  // Saved boxes for this cat + photo (re-renders only when boxes change)
  const savedBoxes = getBoxes(catId, photo.local_id)

  const handleSave = useCallback(
    (box: { x: number; y: number; width: number; height: number }) => {
      addBox(catId, photo.local_id, box)
    },
    [addBox, catId, photo.local_id],
  )

  const { panGesture, liveX, liveY, liveW, liveH } = useBoundingBoxDraw({
    canvasWidth: width,
    canvasHeight: height,
    catId,
    photoId: photo.local_id,
    onSave: handleSave,
  })

  // width/height are runtime props — cannot be static stylesheet values
  return (
    <View style={{ width, height }}>

      {/* Layer 1 (bottom): image */}
      <Image
        source={{ uri: photo.uri }}
        cachePolicy="memory-disk"
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        accessibilityLabel="Cat observation photo"
      />

      {/* Layer 2 (top): Skia canvas, absoluteFill over image only */}
      <GestureDetector gesture={panGesture}>
        <Canvas style={StyleSheet.absoluteFill}>

          {/* Previously saved bounding boxes */}
          {savedBoxes.map((box) => {
            const px = box.x * width
            const py = box.y * height
            const pw = box.width * width
            const ph = box.height * height

            return (
              <Group key={box.id}>
                <Rect x={px} y={py} width={pw} height={ph}
                  color={`${theme.colors.accent}40`} />
                <Rect x={px} y={py} width={pw} height={ph}>
                  <Paint style="stroke" strokeWidth={2} color={theme.colors.accent} />
                </Rect>
              </Group>
            )
          })}

          {/* Live drawing rect — driven by Reanimated SharedValues (UI thread) */}
          <Group>
            <Rect x={liveX} y={liveY} width={liveW} height={liveH}
              color={`${theme.colors.warning}40`} />
            <Rect x={liveX} y={liveY} width={liveW} height={liveH}>
              <Paint style="stroke" strokeWidth={2} color={theme.colors.warning} />
            </Rect>
          </Group>

        </Canvas>
      </GestureDetector>
    </View>
  )
}
