/**
 * components/organisms/AnnotateCarouselItem.tsx
 *
 * Single slide in the annotation carousel.
 *
 * The crop target is a center-anchored crosshair the user can reshape: pinch/
 * pan/double-tap the photo underneath it to position and zoom (unchanged),
 * or drag one of the four edge handles to change its aspect ratio (#286).
 * Long-press the center dot (or tap Confirm) to save the framing and advance
 * — see useBoundingBoxFrame for the gesture + coordinate-transform logic.
 *
 * Persisting the confirmed box is the caller's job (useActiveCatFlow), not
 * this component's — under the annotate-first flow the first confirmed box
 * of a pass is what mints the cat id, so this item can't own that write.
 */

import {
  DOT_HITBOX_SIZE,
  HANDLE_HITBOX_SIZE,
  HANDLE_INSET,
  useBoundingBoxFrame,
} from '@/src/hooks/useBoundingBoxFrame'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import type { BoundingBox } from '@/src/types/BoundingBox'
import type { SubmissionPhoto } from '@/src/types'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated'
import { styles } from './AnnotateCarouselItem.styles'

type BoxInput = Omit<BoundingBox, 'id' | 'cat_id' | 'photo_local_id'>

interface AnnotateCarouselItemProps {
  photo: SubmissionPhoto
  /** The cat currently being discovered, or null before the pass's first box */
  activeCatId: string | null
  /** Width of the carousel slide (= screen width) */
  width: number
  /** Height of the carousel slide (= available height between top bar and buttons) */
  height: number
  /** Called with the confirmed frame — caller persists it and advances */
  onConfirm: (box: BoxInput) => void
  /** Called when the photo crosses the zoomed-in threshold — disable carousel swipe while true */
  onZoomChange?: (zoomedIn: boolean) => void
  /** Called on a fast upward flick of the photo (#204) — same effect as the Not in Photo button */
  onNotInPhoto?: () => void
}

export function AnnotateCarouselItem({
  photo,
  activeCatId,
  width,
  height,
  onConfirm,
  onZoomChange,
  onNotInPhoto,
}: AnnotateCarouselItemProps) {
  const getBoxes = useBoundingBoxStore((s) => s.getBoxes)

  const savedBox = activeCatId
    ? getBoxes(activeCatId, photo.local_id)[0]
    : undefined
  const [natural, setNatural] = useState({ w: 0, h: 0 })

  const {
    photoGesture,
    dotGesture,
    leftHandleGesture,
    rightHandleGesture,
    topHandleGesture,
    bottomHandleGesture,
    userScale,
    userTranslateX,
    userTranslateY,
    boxHalfWidth,
    boxHalfHeight,
    holdProgress,
    confirmNow,
  } = useBoundingBoxFrame({
    canvasWidth: width,
    canvasHeight: height,
    imgNaturalWidth: natural.w,
    imgNaturalHeight: natural.h,
    initialBox: savedBox,
    onConfirm,
    onZoomChange,
    // handleNotInPhoto mints a catId itself when absent (#203), so the
    // gesture no longer needs an activeCatId gate — matches the button,
    // which dropped its disabled={!activeCatId} for the same reason.
    onNotInPhoto,
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

  // Box is center-anchored: its screen rect and crosshair both track the
  // live boxHalfWidth/boxHalfHeight shared values as handles are dragged.
  const boxStyle = useAnimatedStyle(() => ({
    left: width / 2 - boxHalfWidth.value,
    top: height / 2 - boxHalfHeight.value,
    width: boxHalfWidth.value * 2,
    height: boxHalfHeight.value * 2,
  }))

  const crosshairHStyle = useAnimatedStyle(() => ({
    left: width / 2 - boxHalfWidth.value,
    top: height / 2 - 0.5,
    width: boxHalfWidth.value * 2,
  }))

  const crosshairVStyle = useAnimatedStyle(() => ({
    left: width / 2 - 0.5,
    top: height / 2 - boxHalfHeight.value,
    height: boxHalfHeight.value * 2,
  }))

  const leftHandleStyle = useAnimatedStyle(() => ({
    left:
      width / 2 - boxHalfWidth.value + HANDLE_INSET - HANDLE_HITBOX_SIZE / 2,
    top: height / 2 - HANDLE_HITBOX_SIZE / 2,
  }))
  const rightHandleStyle = useAnimatedStyle(() => ({
    left:
      width / 2 + boxHalfWidth.value - HANDLE_INSET - HANDLE_HITBOX_SIZE / 2,
    top: height / 2 - HANDLE_HITBOX_SIZE / 2,
  }))
  const topHandleStyle = useAnimatedStyle(() => ({
    left: width / 2 - HANDLE_HITBOX_SIZE / 2,
    top:
      height / 2 - boxHalfHeight.value + HANDLE_INSET - HANDLE_HITBOX_SIZE / 2,
  }))
  const bottomHandleStyle = useAnimatedStyle(() => ({
    left: width / 2 - HANDLE_HITBOX_SIZE / 2,
    top:
      height / 2 + boxHalfHeight.value - HANDLE_INSET - HANDLE_HITBOX_SIZE / 2,
  }))

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
              onLoad={(e) =>
                setNatural({ w: e.source.width, h: e.source.height })
              }
              accessibilityLabel="Cat observation photo"
            />
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Center-anchored box crosshair — resizes as handles are dragged */}
      <Animated.View pointerEvents="none" style={[styles.box, boxStyle]} />
      <Animated.View
        pointerEvents="none"
        style={[styles.crosshairLine, { height: 1 }, crosshairHStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.crosshairLine, { width: 1 }, crosshairVStyle]}
      />

      {/* Edge handles — single-finger drag reshapes the box's aspect ratio (#286) */}
      <GestureDetector gesture={leftHandleGesture}>
        <Animated.View
          style={[
            styles.handleTouchArea,
            { width: HANDLE_HITBOX_SIZE, height: HANDLE_HITBOX_SIZE },
            leftHandleStyle,
          ]}
          accessibilityLabel="Resize box width, left edge"
        >
          <View style={[styles.handleBar, styles.handleBarVertical]} />
        </Animated.View>
      </GestureDetector>
      <GestureDetector gesture={rightHandleGesture}>
        <Animated.View
          style={[
            styles.handleTouchArea,
            { width: HANDLE_HITBOX_SIZE, height: HANDLE_HITBOX_SIZE },
            rightHandleStyle,
          ]}
          accessibilityLabel="Resize box width, right edge"
        >
          <View style={[styles.handleBar, styles.handleBarVertical]} />
        </Animated.View>
      </GestureDetector>
      <GestureDetector gesture={topHandleGesture}>
        <Animated.View
          style={[
            styles.handleTouchArea,
            { width: HANDLE_HITBOX_SIZE, height: HANDLE_HITBOX_SIZE },
            topHandleStyle,
          ]}
          accessibilityLabel="Resize box height, top edge"
        >
          <View style={[styles.handleBar, styles.handleBarHorizontal]} />
        </Animated.View>
      </GestureDetector>
      <GestureDetector gesture={bottomHandleGesture}>
        <Animated.View
          style={[
            styles.handleTouchArea,
            { width: HANDLE_HITBOX_SIZE, height: HANDLE_HITBOX_SIZE },
            bottomHandleStyle,
          ]}
          accessibilityLabel="Resize box height, bottom edge"
        >
          <View style={[styles.handleBar, styles.handleBarHorizontal]} />
        </Animated.View>
      </GestureDetector>

      {/* Center dot — long-press to confirm */}
      <GestureDetector gesture={dotGesture}>
        <View
          style={[
            styles.dotTouchArea,
            {
              left: width / 2 - DOT_HITBOX_SIZE / 2,
              top: height / 2 - DOT_HITBOX_SIZE / 2,
              width: DOT_HITBOX_SIZE,
              height: DOT_HITBOX_SIZE,
            },
          ]}
        >
          <Animated.View style={[styles.dot, dotStyle]} />
        </View>
      </GestureDetector>

      {/* Confirm button — same effect as holding the dot */}
      <Pressable
        onPress={confirmNow}
        accessibilityRole="button"
        style={styles.confirmBtn}
      >
        <Text style={styles.confirmText}>Confirm</Text>
      </Pressable>
    </View>
  )
}
