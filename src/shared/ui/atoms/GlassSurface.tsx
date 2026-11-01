import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect'
import { useEffect, useState, type ReactNode } from 'react'
import {
  AccessibilityInfo,
  AppState,
  Platform,
  StyleSheet as RNStyleSheet,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import {
  LiquidGlassView,
  type GlassErrorInfo,
} from 'react-native-liquid-glassmorphism'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './GlassSurface.styles'

export type GlassKind = 'card' | 'raised'

interface GlassSurfaceProps {
  /** card: cards and rows on a screen. raised: dialogs and sheets. */
  kind: GlassKind
  /** Layout and shape (radius, padding, size). The fill comes from `kind`. */
  style?: StyleProp<ViewStyle>
  children?: ReactNode
  testID?: string
}

/**
 * The user's "less transparency" setting: Reduce Transparency on iOS, and
 * high-contrast text on Android (Android has no transparency setting). The
 * setting changes in system Settings, which backgrounds the app, so the
 * value is read again when the app returns to the foreground.
 */
export function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    let cancelled = false
    const read = () =>
      (Platform.OS === 'android'
        ? AccessibilityInfo.isHighTextContrastEnabled()
        : AccessibilityInfo.isReduceTransparencyEnabled()
      )
        .then((value) => {
          if (!cancelled) setReduce(value)
        })
        .catch(() => {})
    read()
    const changeSub = AccessibilityInfo.addEventListener(
      Platform.OS === 'android'
        ? 'highTextContrastChanged'
        : 'reduceTransparencyChanged',
      setReduce,
    )
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') read()
    })
    return () => {
      cancelled = true
      changeSub.remove()
      appSub.remove()
    }
  }, [])

  return reduce
}

/**
 * A card or sheet drawn in native glass, tinted from `theme.glass[kind]`:
 *   - iOS: Expo's `GlassView` (expo-glass-effect, the system UIGlassEffect),
 *     when the Liquid Glass API exists at runtime (iOS 26+).
 *   - Android: `LiquidGlassView` (react-native-liquid-glassmorphism).
 *
 * Glass never falls back to a CSS imitation. The surface is the theme's own
 * `colors.surface` when:
 *   - the user asks for less transparency (see useReduceTransparency),
 *   - iOS has no Liquid Glass API (below iOS 26), or
 *   - Android glass reports a fatal error, or BACKDROP_CAPTURE_FAILED (a
 *     native surface such as a camera preview or a map refused the backdrop
 *     capture, and the glass would freeze on a stale frame).
 *
 * Do not put GlassSurface over a live camera preview or a map: those
 * screens use `colors.surface` directly.
 */
export function GlassSurface({
  kind,
  style,
  children,
  testID,
}: GlassSurfaceProps) {
  const { theme, rt } = useUnistyles()
  const reduceTransparency = useReduceTransparency()
  const [glassFailed, setGlassFailed] = useState(false)
  const tint = theme.glass[kind]

  const iosGlass =
    Platform.OS === 'ios' &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable()
  const androidGlass = Platform.OS === 'android' && !glassFailed

  if (reduceTransparency || !(iosGlass || androidGlass)) {
    return (
      <View testID={testID} style={[styles.fallback, style]}>
        {children}
      </View>
    )
  }

  if (iosGlass) {
    return (
      <GlassView
        testID={testID}
        tintColor={tint}
        // Follow the app's theme mode, not the system appearance.
        colorScheme={rt.themeName === 'dark' ? 'dark' : 'light'}
        style={style}
      >
        {children}
      </GlassView>
    )
  }

  const onError = ({
    nativeEvent: { code, fatal },
  }: NativeSyntheticEvent<GlassErrorInfo>) => {
    if (fatal || code === 'BACKDROP_CAPTURE_FAILED') setGlassFailed(true)
  }

  // The Android glass takes its corner radius as a prop, not from style.
  const { borderRadius } = RNStyleSheet.flatten(style) ?? {}

  return (
    <LiquidGlassView
      testID={testID}
      tintColor={tint}
      borderRadius={typeof borderRadius === 'number' ? borderRadius : 0}
      onError={onError}
      style={style}
    >
      {children}
    </LiquidGlassView>
  )
}
