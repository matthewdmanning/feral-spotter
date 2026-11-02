import { memo } from 'react'
import { View, Text } from 'react-native'
import { Image } from 'expo-image'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { styles } from './CameraThumb.styles'

export { THUMB_SIZE, THUMB_GAP, THUMB_TOTAL } from './CameraThumb.constants'

// Swipe up past this distance (px) to discard — short enough to feel
// intentional without requiring a near-full-screen drag.
const REMOVE_THRESHOLD = -60

interface CameraThumbProps {
  uri: string
  badgeCount: number
  onRemove: () => void
  /** Spoken name, e.g. "Photo 2 of 5": identical names made thumbs indistinguishable. */
  label?: string
}

export const CameraThumb = memo(function CameraThumb({
  uri,
  badgeCount,
  onRemove,
  label = 'Photo',
}: CameraThumbProps) {
  const translateY = useSharedValue(0)
  const opacity = useSharedValue(1)

  // Vertical-only, directional-locked so it doesn't steal the horizontal
  // FlashList scroll — same idiom as useBoundingBoxFrame.ts's gesture
  // composition (activeOffsetY commits to this gesture, failOffsetX yields
  // to the list on a horizontal drag).
  const swipeUp = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-10, 10])
    .onUpdate((e) => {
      'worklet'
      if (e.translationY < 0) translateY.value = e.translationY
    })
    .onEnd((e) => {
      'worklet'
      if (e.translationY < REMOVE_THRESHOLD) {
        opacity.value = withTiming(0, { duration: 150 })
        translateY.value = withTiming(-120, { duration: 150 }, (finished) => {
          if (!finished) return
          runOnJS(onRemove)()
          // If the parent keeps this thumb (the removal was refused), it must
          // not stay invisible but still touchable.
          translateY.value = withTiming(0)
          opacity.value = withTiming(1)
        })
      } else {
        translateY.value = withTiming(0)
      }
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }))

  return (
    <GestureDetector gesture={swipeUp}>
      <Animated.View
        style={[styles.wrap, animatedStyle]}
        accessible
        // An image with a discard action: double-tap has nothing to do, so it
        // is not announced as a button.
        accessibilityRole="image"
        accessibilityLabel={label}
        accessibilityActions={[{ name: 'discard', label: 'Discard photo' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'discard') onRemove()
        }}
      >
        <Image
          source={{ uri }}
          cachePolicy="memory-disk"
          style={styles.image}
          contentFit="cover"
        />
        {badgeCount > 1 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeCount}</Text>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  )
})
