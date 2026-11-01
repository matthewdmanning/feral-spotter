/**
 * shared/ui/molecules/BottomButtonColumn.tsx
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
import { AppButton, type ColumnButton } from '@/src/shared/ui/atoms/AppButton'
import { useEffect } from 'react'
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
}

export function BottomButtonColumn({
  buttons,
  visible,
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
  }))

  return (
    // [Unistyles style, Reanimated style] — never merged/spread together
    // Touch and TalkBack follow `visible` at once, not the fade: a hiding
    // column must not keep tappable or focusable buttons. (pointerEvents used
    // to live in the animated style, keyed to the faded opacity.)
    <Animated.View
      style={[styles.container, animatedStyle]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      {buttons.map((btn) => (
        <AppButton
          key={btn.key}
          onPress={btn.onPress}
          variant={btn.variant}
          disabled={btn.disabled}
          accessibilityLabel={btn.accessibilityLabel}
        >
          {btn.label}
        </AppButton>
      ))}
    </Animated.View>
  )
}
