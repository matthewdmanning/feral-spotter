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
  it('forwards a subject clear while disabled, but refuses a new subject region', async () => {
    useSettingsStore
      .getState()
      .updateSettings({ camera_subject_metering: false })
    const setSubjectRegion = jest.fn(async () => false)
    const { result } = await renderHook(() => useNativeCameraCapture())
    await act(() => {
      result.current.cameraRef.current = { setSubjectRegion } as never
    })

    await act(async () => {
      await result.current.applySubjectRegion(null)
      await result.current.applySubjectRegion({
        x: 0.2,
        y: 0.2,
        width: 0.4,
        height: 0.4,
      })
    })

    expect(setSubjectRegion).toHaveBeenCalledTimes(1)
    expect(setSubjectRegion).toHaveBeenCalledWith(null)
  })

  it('focuses through the native ref when subject metering is disabled', async () => {
    useSettingsStore
      .getState()
      .updateSettings({ camera_subject_metering: false })
    const focus = jest.fn(async () => true)
    const { result } = await renderHook(() => useNativeCameraCapture())

    await act(() => {
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
