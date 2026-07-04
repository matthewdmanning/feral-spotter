/**
 * components/organisms/AnnotateCarouselItem.tsx
 *
 * Single slide in the annotation carousel.
 *
 * The crop target is a fixed, centered square crosshair (side = shortest
 * screen dimension). The user pinches/pans/double-taps the photo underneath
 * it to frame the cat, then long-presses the center dot (or taps Confirm) to
 * save the framing and advance — see useBoundingBoxFrame for the gesture +
 * coordinate-transform logic.
 */

import { DOT_HITBOX_SIZE, useBoundingBoxFrame } from '@/src/hooks/useBoundingBoxFrame'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import type { SubmissionPhoto } from '@/src/types'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated'
import { styles } from './AnnotateCarouselItem.styles'

interface AnnotateCarouselItemProps {
  photo: SubmissionPhoto
  catId: string
  /** Width of the carousel slide (= screen width) */
  width: number
  /** Height of the carousel slide (= available height between top bar and buttons) */
  height: number
  /** Called after a confirmed frame is saved — typically advances to the next photo */
  onConfirm: () => void
  /** Called when the photo crosses the zoomed-in threshold — disable carousel swipe while true */
  onZoomChange?: (zoomedIn: boolean) => void
}

export function AnnotateCarouselItem({
  photo, catId, width, height, onConfirm, onZoomChange,
}: AnnotateCarouselItemProps) {
  const addBox = useBoundingBoxStore((s) => s.addBox)
  const getBoxes = useBoundingBoxStore((s) => s.getBoxes)

  const savedBox = getBoxes(catId, photo.local_id)[0]
  const [natural, setNatural] = useState({ w: 0, h: 0 })

  const handleFrameConfirm = useCallback(
    (box: Parameters<typeof addBox>[2]) => {
      addBox(catId, photo.local_id, box)
      onConfirm()
    },
    [addBox, catId, photo.local_id, onConfirm],
  )

  const { photoGesture, dotGesture, userScale, userTranslateX, userTranslateY, holdProgress, confirmNow } =
    useBoundingBoxFrame({
      canvasWidth: width,
      canvasHeight: height,
      imgNaturalWidth: natural.w,
      imgNaturalHeight: natural.h,
      initialBox: savedBox,
      onConfirm: handleFrameConfirm,
      onZoomChange,
    })

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: userTranslateX.value },
      { translateY: userTranslateY.value },
      { scale: userScale.value },
    ],
  }))

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(holdProgress.value, [0, 1], [1, 1.4]) }],
    opacity: interpolate(holdProgress.value, [0, 1], [1, 0.6]),
  }))

  const squareSize = Math.min(width, height)
  const squareX = (width - squareSize) / 2
  const squareY = (height - squareSize) / 2

  // width/height are runtime props — cannot be static stylesheet values
  return (
    <View style={{ width, height }}>

      {/* Photo: pinch/pan/double-tap to frame */}
      <GestureDetector gesture={photoGesture}>
        <View style={styles.photoLayer}>
          <Animated.View style={[{ flex: 1 }, imageStyle]}>
            <Image
              source={{ uri: photo.uri }}
              cachePolicy="memory-disk"
              style={{ width, height }}
              contentFit="contain"
              onLoad={(e) => setNatural({ w: e.source.width, h: e.source.height })}
              accessibilityLabel="Cat observation photo"
            />
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Fixed centered square crosshair — crosshair lines drawn inside the square */}
      <View pointerEvents="none" style={[styles.square, { left: squareX, top: squareY, width: squareSize, height: squareSize }]}>
        <View style={[styles.crosshairLine, { left: 0, top: squareSize / 2 - 0.5, width: squareSize, height: 1 }]} />
        <View style={[styles.crosshairLine, { left: squareSize / 2 - 0.5, top: 0, width: 1, height: squareSize }]} />
      </View>

      {/* Center dot — long-press to confirm */}
      <GestureDetector gesture={dotGesture}>
        <View style={[styles.dotTouchArea, {
          left: width / 2 - DOT_HITBOX_SIZE / 2,
          top: height / 2 - DOT_HITBOX_SIZE / 2,
          width: DOT_HITBOX_SIZE,
          height: DOT_HITBOX_SIZE,
        }]}>
          <Animated.View style={[styles.dot, dotStyle]} />
        </View>
      </GestureDetector>

      {/* Confirm button — same effect as holding the dot */}
      <Pressable onPress={confirmNow} accessibilityRole="button" style={styles.confirmBtn}>
        <Text style={styles.confirmText}>Confirm</Text>
      </Pressable>
    </View>
  )
}
