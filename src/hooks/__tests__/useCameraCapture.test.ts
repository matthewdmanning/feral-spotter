import { renderHook } from '@testing-library/react-native'
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
  getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  getCurrentPositionAsync: jest.fn(),
  PermissionStatus: { GRANTED: 'granted' },
  Accuracy: { Balanced: 3 },
}))

jest.mock('expo-router', () => ({ router: { back: jest.fn(), navigate: jest.fn() } }))

jest.mock('react-native-vision-camera', () => ({
  useCameraDevice: jest.fn(() => ({ id: 'back' })),
  usePhotoOutput: jest.fn(() => ({ capturePhoto: jest.fn() })),
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
  usePhotoStore: (sel: (s: object) => unknown) => sel({ addPhoto: jest.fn(), photos: [] }),
  useUIStore: (sel: (s: object) => unknown) =>
    sel({ addSessionPhoto: jest.fn(), sessionPhotos: [] }),
}))

jest.mock('@/src/hooks/useSettingsStore', () => ({
  useSettingsStore: (sel: (s: object) => unknown) =>
    sel({ settings: { keep_photos_on_device: false } }),
}))

jest.mock('@shopify/flash-list', () => ({ FlashList: 'FlashList' }))
jest.mock('@/src/components/atoms/CameraThumb', () => ({ CameraThumb: 'CameraThumb' }))
jest.mock('expo-media-library', () => ({}))
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-id' }))

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
