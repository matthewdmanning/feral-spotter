import { act, renderHook } from '@testing-library/react-native'
import { useNativeCameraCapture } from '../useNativeCameraCapture'

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

describe('useNativeCameraCapture manual focus', () => {
  it('focuses through the native ref when subject metering is disabled', async () => {
    const focus = jest.fn(async () => true)
    const { result } = renderHook(() => useNativeCameraCapture())

    act(() => {
      result.current.cameraRef.current = { focus } as never
    })

    let accepted = false
    await act(async () => {
      accepted = await result.current.focus({ x: 0.25, y: 0.75 })
    })

    expect(accepted).toBe(true)
    expect(focus).toHaveBeenCalledWith({ x: 0.25, y: 0.75 })
  })
})
