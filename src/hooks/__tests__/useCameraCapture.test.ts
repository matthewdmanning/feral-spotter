import { act, renderHook } from '@testing-library/react-native'
import { router } from 'expo-router'
import { AppState } from 'react-native'
import { useCameraCapture } from '../useCameraCapture'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}))

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'denied' }),
  ),
  getCurrentPositionAsync: jest.fn(),
  PermissionStatus: { GRANTED: 'granted' },
  Accuracy: { Balanced: 3 },
}))

let mockIsFocused = true
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), navigate: jest.fn() },
  useIsFocused: () => mockIsFocused,
}))

const mockCapturePhoto = jest.fn()
jest.mock('react-native-vision-camera', () => ({
  useCameraDevice: jest.fn(() => ({ id: 'back' })),
  usePhotoOutput: jest.fn(() => ({ capturePhoto: mockCapturePhoto })),
  Camera: 'Camera',
}))

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  useSharedValue: jest.fn((v: unknown) => ({ value: v })),
  useAnimatedStyle: jest.fn(() => ({})),
  withTiming: jest.fn((v: unknown) => v),
  Easing: { out: jest.fn(), quad: {}, back: jest.fn() },
}))

jest.mock('@/src/hooks', () => ({
  usePhotoStore: (sel: (s: object) => unknown) =>
    sel({ addPhoto: jest.fn(), photos: [] }),
}))

jest.mock('@/src/hooks/useSettingsStore', () => ({
  useSettingsStore: (sel: (s: object) => unknown) =>
    sel({ settings: { keep_photos_on_device: true } }),
}))

jest.mock('@shopify/flash-list', () => ({ FlashList: 'FlashList' }))
jest.mock('@/src/components/atoms/CameraThumb', () => ({
  CameraThumb: 'CameraThumb',
}))
const mockAssetCreate = jest.fn()
const mockGetPermissionsAsync = jest.fn(async () => ({ status: 'granted' }))
const mockRequestPermissionsAsync = jest.fn(async () => ({
  status: 'granted',
}))
jest.mock('expo-media-library', () => ({
  get Asset() {
    return { create: mockAssetCreate }
  },
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) =>
    mockRequestPermissionsAsync(...args),
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
}))
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-id' }))

const mockCaptureEvent = jest.fn()
jest.mock('@/src/lib/analytics/analytics', () => ({
  captureEvent: (...args: unknown[]) => mockCaptureEvent(...args),
  EVENTS: {
    CAMERA_OPENED: 'camera_opened',
    PHOTO_CAPTURE_FAILED: 'photo_capture_failed',
  },
}))

describe('useCameraCapture isActive (#253)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsFocused = true
  })

  it('starts active when the screen is focused and the app is foregrounded', () => {
    const { result } = renderHook(() => useCameraCapture())
    expect(result.current.isActive).toBe(true)
  })

  it('goes inactive on background and reactivates on foreground, without unmounting', () => {
    let listener: ((state: string) => void) | undefined
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, l) => {
      listener = l as (state: string) => void
      return { remove: jest.fn() }
    })

    const { result } = renderHook(() => useCameraCapture())
    expect(result.current.isActive).toBe(true)

    act(() => listener?.('background'))
    expect(result.current.isActive).toBe(false)

    act(() => listener?.('active'))
    expect(result.current.isActive).toBe(true)
  })

  it('stays inactive while foregrounded if the screen has navigated away', () => {
    mockIsFocused = false
    const { result } = renderHook(() => useCameraCapture())
    expect(result.current.isActive).toBe(false)
  })
})

describe('useCameraCapture navigation', () => {
  beforeEach(() => jest.clearAllMocks())

  it('handleClose calls router.back()', () => {
    const { result } = renderHook(() => useCameraCapture())
    result.current.handleClose()
    expect(router.back).toHaveBeenCalledTimes(1)
  })

  it('handleDone navigates to /submission/create', () => {
    const { result } = renderHook(() => useCameraCapture())
    result.current.handleDone()
    expect(router.navigate).toHaveBeenCalledWith('/submission/create')
  })
})

describe('useCameraCapture handleTakePhoto', () => {
  beforeEach(() => jest.clearAllMocks())

  it('reports PHOTO_CAPTURE_FAILED when capturePhoto throws', async () => {
    mockCapturePhoto.mockRejectedValueOnce(new Error('device busy'))

    const { result } = renderHook(() => useCameraCapture())
    mockCaptureEvent.mockClear()

    await act(async () => {
      await result.current.handleTakePhoto()
    })

    expect(mockCaptureEvent).toHaveBeenCalledWith('photo_capture_failed', {
      error: 'device busy',
    })
    expect(result.current.capturedPhotos).toHaveLength(0)
  })

  it('keeps the captured photo in review state even if the gallery save fails', async () => {
    mockCapturePhoto.mockResolvedValueOnce({
      width: 100,
      height: 100,
      saveToTemporaryFileAsync: jest.fn(async () => '/tmp/fake.jpg'),
      dispose: jest.fn(),
    })
    mockAssetCreate.mockRejectedValueOnce(new Error('save failed'))

    const { result } = renderHook(() => useCameraCapture())

    await act(async () => {
      await result.current.handleTakePhoto()
    })

    expect(result.current.capturedPhotos).toHaveLength(1)
  })

  it('#145/#146: requests write-only gallery access once at mount, never re-requests from the shutter path', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' })
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' })

    mockCapturePhoto.mockResolvedValue({
      width: 100,
      height: 100,
      saveToTemporaryFileAsync: jest.fn(async () => '/tmp/fake.jpg'),
      dispose: jest.fn(),
    })

    const { result } = renderHook(() => useCameraCapture())
    // let the mount-time permission-request effect resolve first
    await act(async () => {})

    await act(async () => {
      await result.current.handleTakePhoto()
    })
    await act(async () => {
      await result.current.handleTakePhoto()
    })

    // requestPermissionsAsync only ever fires once, from the mount effect —
    // repeated shutter presses with a still-denied status must not
    // re-trigger it, and it must ask for write-only (add-only) access, not
    // full read — that's what pulled in the Android 14+ "Select photos"
    // picker (#140) when this used to gate on READ_MEDIA_IMAGES.
    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1)
    expect(mockRequestPermissionsAsync).toHaveBeenCalledWith(true)
    expect(mockAssetCreate).not.toHaveBeenCalled()
  })
})
