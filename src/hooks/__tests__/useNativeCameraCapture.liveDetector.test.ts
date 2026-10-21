import { renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { useNativeCameraCapture } from '../useNativeCameraCapture'

// The live detector is Android-only native code. This guards the one place
// that keeps the setting from reaching the iOS view, where the prop has no
// implementation and a true value would silently do nothing.

jest.mock('@/src/hooks/useCapturedPhotoWorkflow', () => ({
  useCapturedPhotoWorkflow: jest.fn(() => ({})),
}))

jest.mock('@/src/hooks/useConsentStore', () => ({
  useConsentStore: { persist: { hasHydrated: jest.fn(() => true) } },
}))

jest.mock('@/src/hooks/useSettingsStore', () => ({
  useSettingsStore: (
    selector: (state: { settings: Record<string, boolean> }) => unknown,
  ) =>
    selector({
      settings: {
        camera_max_detail: true,
        camera_motion_priority: true,
        camera_disable_low_light_boost: false,
        camera_subject_metering: false,
        camera_pinch_zoom: false,
        camera_performance_checks: false,
        camera_live_detector: true,
      },
    }),
}))

jest.mock('@/src/lib/analytics/analytics', () => ({
  captureEvent: jest.fn(),
  EVENTS: { CAMERA_OPENED: 'camera_opened' },
}))

jest.mock('@/src/lib/auth/useAuth', () => ({
  useAuth: () => ({ user: null }),
}))

jest.mock('@/src/lib/location', () => ({
  startLocationCapture: jest.fn(async () => undefined),
}))

describe('useNativeCameraCapture live detector', () => {
  const cases: [typeof Platform.OS, boolean][] = [
    ['android', true],
    ['ios', false],
  ]

  it.each(cases)('on %s with the setting on resolves to %p', (os, expected) => {
    jest.replaceProperty(Platform, 'OS', os)
    const { result } = renderHook(() => useNativeCameraCapture())
    expect(result.current.liveDetector).toBe(expected)
  })
})
