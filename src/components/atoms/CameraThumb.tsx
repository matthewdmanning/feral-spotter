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
}

export const CameraThumb = memo(function CameraThumb({
  uri,
  badgeCount,
  onRemove,
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
          if (finished) runOnJS(onRemove)()
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
        accessibilityRole="button"
        accessibilityLabel="Photo"
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
