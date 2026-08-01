import { act, renderHook } from '@testing-library/react-native'
import { router } from 'expo-router'
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

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), navigate: jest.fn() },
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
jest.mock('expo-media-library', () => ({
  get Asset() {
    return { create: mockAssetCreate }
  },
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
})
