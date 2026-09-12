/**
 * components/molecules/BottomButtonColumn.tsx
 *
 * Unistyles v3 + Reanimated best practice:
 *   NEVER spread or merge Unistyles styles into useAnimatedStyle.
 *   Keep them in separate style props on the Animated.View:
 *     style={[styles.container, animatedStyle]}
 *
 * This owns the reveal animation and the stacking only. Button appearance is
 * AppButton's, not duplicated here — it previously carried its own
 * primary/secondary/ghost/danger colour maps, which drifted from AppButton's
 * variants of the same names.
 */
import { AppButton, type ColumnButton } from '@/src/components/atoms/AppButton'
import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { styles } from './BottomButtonColumn.styles'

interface BottomButtonColumnProps {
  buttons: ColumnButton[]
  visible: boolean
  spacing?: number
  paddingBottom?: number
}

export function BottomButtonColumn({
  buttons,
  visible,
  spacing = 12,
  paddingBottom = 16,
}: BottomButtonColumnProps) {
  // Reanimated SharedValues — UI thread animation
  const opacity = useSharedValue(visible ? 1 : 0)
  const scaleY = useSharedValue(visible ? 1 : 0)

  useEffect(() => {
    const cfg = { duration: 220, easing: Easing.out(Easing.quad) }
    opacity.value = withTiming(visible ? 1 : 0, cfg)
    scaleY.value = withTiming(visible ? 1 : 0, cfg)
  }, [opacity, scaleY, visible])

  // Reanimated style kept SEPARATE from Unistyles styles
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scaleY: scaleY.value }],
    overflow: 'hidden',
    pointerEvents: opacity.value < 0.05 ? 'none' : 'auto',
  }))

  return (
    // [Unistyles style, Reanimated style] — never merged/spread together
    <Animated.View style={[styles.container, { paddingBottom }, animatedStyle]}>
      {buttons.map((btn, i) => (
        <View key={btn.key} style={i > 0 ? { marginTop: spacing } : undefined}>
          <AppButton
            onPress={btn.onPress}
            variant={btn.variant}
            disabled={btn.disabled}
            accessibilityLabel={btn.accessibilityLabel}
          >
            {btn.label}
          </AppButton>
        </View>
      ))}
    </Animated.View>
  )
}
