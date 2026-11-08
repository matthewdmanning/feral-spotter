import { act, renderHook } from '@testing-library/react-native'
import { useNativeCameraCapture } from '@/src/features/camera-control/hooks/useNativeCameraCapture'
import { useSettingsStore } from '@/src/features/settings/hooks/useSettingsStore'

jest.mock(
  '@/src/features/camera-control/hooks/useCapturedPhotoWorkflow',
  () => ({
    useCapturedPhotoWorkflow: jest.fn(() => ({})),
  }),
)

jest.mock('@/src/shared/analytics/analytics', () => ({
  ...jest.requireActual('@/src/shared/analytics/analytics'),
  captureEvent: jest.fn(),
}))

jest.mock('@/src/features/auth/lib/useAuth', () => ({
  useAuth: () => ({ user: null }),
}))

jest.mock('@/src/core/location/liveFix', () => ({
  startLocationCapture: jest.fn(async () => undefined),
}))

describe('useNativeCameraCapture manual focus', () => {
  it('focuses through the native ref when subject metering is disabled', async () => {
    useSettingsStore
      .getState()
      .updateSettings({ camera_subject_metering: false })
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
