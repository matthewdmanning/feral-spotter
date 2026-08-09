import { act, renderHook } from '@testing-library/react-native'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { useCameraCapture } from '../useCameraCapture'

/**
 * Models the two button-driven cycles on the Camera screen
 * (src/screens/camera/index.tsx) that useCameraCapture.test.ts doesn't
 * cover: flash-mode cycling (cycleFlash, the flash icon button) and
 * camera-flip (flipCamera, the SwitchCamera button). Both are small,
 * self-contained state cycles with no prior coverage.
 */
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

const mockUseCameraDevice = jest.fn((position: string) => ({ id: position }))
jest.mock('react-native-vision-camera', () => ({
  useCameraDevice: (position: string) => mockUseCameraDevice(position),
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
jest.mock('expo-media-library', () => ({
  get Asset() {
    return { create: jest.fn() }
  },
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
}))
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-id' }))
jest.mock('@/src/lib/analytics/analytics', () => ({
  captureEvent: jest.fn(),
  EVENTS: { CAMERA_OPENED: 'camera_opened', PHOTO_CAPTURE_FAILED: 'x' },
}))

describe('useCameraCapture — flash-mode cycle (model-based test)', () => {
  let result: ReturnType<
    typeof renderHook<ReturnType<typeof useCameraCapture>, void>
  >

  beforeEach(() => {
    result = renderHook(() => useCameraCapture())
  })

  const flashMachine = createMachine({
    id: 'flashCycle',
    initial: 'auto',
    states: {
      auto: { on: { PRESS_FLASH: 'on' } },
      on: { on: { PRESS_FLASH: 'off' } },
      off: { on: { PRESS_FLASH: 'auto' } },
    },
  })

  const model = createTestModel(flashMachine)

  const testParams = {
    states: {
      auto: () => expect(result.result.current.flashMode).toBe('auto'),
      on: () => expect(result.result.current.flashMode).toBe('on'),
      off: () => expect(result.result.current.flashMode).toBe('off'),
    },
    events: {
      PRESS_FLASH: () => act(() => result.result.current.cycleFlash()),
    },
  }

  const journeys = [
    { name: 'starts on auto', events: [] },
    { name: 'one press: auto -> on', events: [{ type: 'PRESS_FLASH' }] },
    {
      name: 'two presses: auto -> on -> off',
      events: [{ type: 'PRESS_FLASH' }, { type: 'PRESS_FLASH' }],
    },
    {
      name: 'three presses cycles back to auto',
      events: [
        { type: 'PRESS_FLASH' },
        { type: 'PRESS_FLASH' },
        { type: 'PRESS_FLASH' },
      ],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })
})

describe('useCameraCapture — camera-flip toggle (model-based test)', () => {
  let result: ReturnType<
    typeof renderHook<ReturnType<typeof useCameraCapture>, void>
  >

  beforeEach(() => {
    mockUseCameraDevice.mockClear()
    result = renderHook(() => useCameraCapture())
  })

  const flipMachine = createMachine({
    id: 'cameraFlip',
    initial: 'back',
    states: {
      back: { on: { PRESS_FLIP: 'front' } },
      front: { on: { PRESS_FLIP: 'back' } },
    },
  })

  const model = createTestModel(flipMachine)

  const testParams = {
    states: {
      back: () => expect(mockUseCameraDevice).toHaveBeenLastCalledWith('back'),
      front: () =>
        expect(mockUseCameraDevice).toHaveBeenLastCalledWith('front'),
    },
    events: {
      PRESS_FLIP: () => act(() => result.result.current.flipCamera()),
    },
  }

  const journeys = [
    { name: 'starts on the back camera', events: [] },
    {
      name: 'one press flips to the front camera',
      events: [{ type: 'PRESS_FLIP' }],
    },
    {
      name: 'two presses flips back to the back camera',
      events: [{ type: 'PRESS_FLIP' }, { type: 'PRESS_FLIP' }],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })
})
