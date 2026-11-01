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

import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import {
  DOT_HITBOX_SIZE,
  HANDLE_HITBOX_SIZE,
  HANDLE_INSET,
  useBoundingBoxFrame,
} from '@/src/hooks/useBoundingBoxFrame'
import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { useSubmissionStore } from '@/src/features/draft-submission/hooks/useSubmissionStore'
import { containFit } from '@/src/shared/lib/geometry/cropProjection'
import { previousCatBoxes } from '@/src/lib/annotate/previousBoxes'
import type { BoundingBox } from '@/src/shared/types/BoundingBox'
import type { SubmissionPhoto } from '@/src/shared/types'
import { useState } from 'react'
import { View } from 'react-native'
import { Image } from 'expo-image'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'
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
  const { theme } = useUnistyles()
  const getBoxes = useBoundingBoxStore((s) => s.getBoxes)
  const boxes = useBoundingBoxStore((s) => s.boxes)
  const catColors = useBoundingBoxStore((s) => s.catColors)
  const savedCats = useSubmissionStore((s) => s.cats)

  const savedBox = activeCatId
    ? getBoxes(activeCatId, photo.local_id)[0]
    : undefined
  const [natural, setNatural] = useState({ w: 0, h: 0 })

  // Boxes of the cats already recorded, each in its cat's own color.
  const previousBoxes = previousCatBoxes(
    savedCats.map((cat) => cat.local_id),
    activeCatId,
    photo.local_id,
    boxes,
    catColors,
  )
  // The photo sits contain-fit in the canvas; normalised boxes map onto that
  // rect. Nothing to place until the image reports its size.
  const fitted = natural.w > 0 && natural.h > 0
  const {
    baseScale: fit,
    baseOffsetX: fitX,
    baseOffsetY: fitY,
  } = fitted
    ? containFit({
        canvasWidth: width,
        canvasHeight: height,
        imgNaturalWidth: natural.w,
        imgNaturalHeight: natural.h,
      })
    : { baseScale: 0, baseOffsetX: 0, baseOffsetY: 0 }
  const fitW = natural.w * fit
  const fitH = natural.h * fit

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

  // Edge handles — single-finger drag reshapes the box's aspect ratio (#286).
  const handles = [
    {
      label: 'Resize box width, left edge',
      gesture: leftHandleGesture,
      style: leftHandleStyle,
      barStyle: styles.handleBarVertical,
    },
    {
      label: 'Resize box width, right edge',
      gesture: rightHandleGesture,
      style: rightHandleStyle,
      barStyle: styles.handleBarVertical,
    },
    {
      label: 'Resize box height, top edge',
      gesture: topHandleGesture,
      style: topHandleStyle,
      barStyle: styles.handleBarHorizontal,
    },
    {
      label: 'Resize box height, bottom edge',
      gesture: bottomHandleGesture,
      style: bottomHandleStyle,
      barStyle: styles.handleBarHorizontal,
    },
  ]

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
            {previousBoxes.map(({ box, colorSlot }) => (
              <View
                key={box.id}
                pointerEvents="none"
                style={[
                  styles.previousBox,
                  {
                    borderColor:
                      (colorSlot !== undefined &&
                        theme.catPalette[colorSlot]) ||
                      theme.colors.muted,
                    left: fitX + box.lowerLeftX * fitW,
                    top: fitY + box.upperRightY * fitH,
                    width: (box.upperRightX - box.lowerLeftX) * fitW,
                    height: (box.lowerLeftY - box.upperRightY) * fitH,
                  },
                ]}
              />
            ))}
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
      {handles.map((handle) => (
        <GestureDetector key={handle.label} gesture={handle.gesture}>
          <Animated.View
            style={[
              styles.handleTouchArea,
              { width: HANDLE_HITBOX_SIZE, height: HANDLE_HITBOX_SIZE },
              handle.style,
            ]}
            accessibilityLabel={handle.label}
          >
            <View style={[styles.handleBar, handle.barStyle]} />
          </Animated.View>
        </GestureDetector>
      ))}

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
      <View style={styles.confirmWrap}>
        <AppButton onPress={confirmNow} size="compact">
          Confirm
        </AppButton>
      </View>
    </View>
  )
}
