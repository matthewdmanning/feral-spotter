import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { isGlassEffectAPIAvailable } from 'expo-glass-effect'
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native'
import { UnistylesRuntime } from 'react-native-unistyles'
import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'

// The failure this guards: a surface that should have gone to the theme
// surface keeps drawing glass (frozen over a native view, missing on old
// iOS, or translucent for a user who asked for less transparency), or a
// harmless warning drops good glass.

jest.mock('expo-glass-effect', () => ({
  ...jest.requireActual('expo-glass-effect'),
  isGlassEffectAPIAvailable: jest.fn(() => true),
  isLiquidGlassAvailable: jest.fn(() => true),
}))

const isThemeSurface = () =>
  StyleSheet.flatten(screen.getByTestId('glass').props.style)
    ?.backgroundColor === UnistylesRuntime.getTheme().colors.surface

// Each platform reads a different signal. The other one gets the opposite
// value, so a surface that reads the wrong signal fails the case.
const setReduceTransparency = (value: boolean) => {
  jest
    .spyOn(AccessibilityInfo, 'isHighTextContrastEnabled')
    .mockResolvedValue(Platform.OS === 'android' ? value : !value)
  jest
    .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
    .mockResolvedValue(Platform.OS === 'ios' ? value : !value)
}

const renderSettled = async () => {
  render(<GlassSurface kind="card" testID="glass" />)
  // Wait for the platform's accessibility read, then let its result apply.
  await waitFor(() =>
    expect(
      jest.mocked(
        Platform.OS === 'android'
          ? AccessibilityInfo.isHighTextContrastEnabled
          : AccessibilityInfo.isReduceTransparencyEnabled,
      ),
    ).toHaveBeenCalled(),
  )
  await act(async () => {})
}

afterEach(() => {
  jest.restoreAllMocks()
  jest.mocked(isGlassEffectAPIAvailable).mockReturnValue(true)
})

describe('Android', () => {
  beforeEach(() => jest.replaceProperty(Platform, 'OS', 'android'))

  it.each([
    { reduce: false, error: null, surface: false },
    { reduce: true, error: null, surface: true },
    {
      reduce: false,
      error: { code: 'BACKDROP_CAPTURE_FAILED', fatal: false },
      surface: true,
    },
    {
      reduce: false,
      error: { code: 'SHADER_COMPILE_FAILED', fatal: true },
      surface: true,
    },
    {
      reduce: false,
      error: { code: 'PIPELINE_DEGRADED', fatal: false },
      surface: false,
    },
  ])(
    'uses the theme surface only when glass cannot draw: %p',
    async ({ reduce, error, surface }) => {
      setReduceTransparency(reduce)
      await renderSettled()

      if (error) {
        fireEvent(screen.getByTestId('glass'), 'error', {
          nativeEvent: { ...error, message: '' },
        })
      }

      expect(isThemeSurface()).toBe(surface)
    },
  )
})

describe('iOS', () => {
  beforeEach(() => jest.replaceProperty(Platform, 'OS', 'ios'))

  it.each([
    { reduce: false, api: true, surface: false },
    { reduce: true, api: true, surface: true },
    { reduce: false, api: false, surface: true },
  ])(
    'uses the theme surface without Liquid Glass or with less transparency: %p',
    async ({ reduce, api, surface }) => {
      setReduceTransparency(reduce)
      jest.mocked(isGlassEffectAPIAvailable).mockReturnValue(api)
      await renderSettled()

      expect(isThemeSurface()).toBe(surface)
    },
  )
})
