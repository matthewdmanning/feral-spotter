import { fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { useCameraAccess } from '@/src/hooks/useCameraAccess'
import { useCameraCapture } from '@/src/hooks/useCameraCapture'
import CameraScreen from '../index'

/**
 * Model of CameraScreen's (src/screens/camera/index.tsx) two gate screens —
 * logic that lives directly in the screen's JSX, not delegated to a hook, and
 * has no coverage anywhere else. The main capture view's buttons (shutter,
 * flip, flash, close, done) are thin onPress={handler} wiring onto
 * useCameraCapture, which already has direct handler-level coverage
 * (useCameraCapture.test.ts, useCameraCapture.controls.model.test.ts) —
 * re-testing that wiring through a full react-native-vision-camera render
 * would duplicate that coverage without adding real assurance.
 */
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}))

jest.mock('react-native-unistyles', () => {
  const anyProp = (): unknown => new Proxy({}, { get: (_t, _k) => anyProp() })
  const theme = new Proxy({}, { get: (_t, _k) => anyProp() })
  return { useUnistyles: () => ({ theme }) }
})

jest.mock('../index.styles', () => ({
  styles: new Proxy({}, { get: () => ({}) }),
}))

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  useSharedValue: jest.fn((v: unknown) => ({ value: v })),
  useAnimatedStyle: jest.fn(() => ({})),
  withTiming: jest.fn((v: unknown) => v),
  Easing: { out: jest.fn(), quad: {}, back: jest.fn() },
}))

jest.mock('react-native-vision-camera', () => ({ Camera: 'Camera' }))
jest.mock('@shopify/flash-list', () => ({ FlashList: 'FlashList' }))
jest.mock('lucide-react-native', () => ({
  SwitchCamera: () => null,
  X: () => null,
  Zap: () => null,
  ZapOff: () => null,
}))

jest.mock('@/src/hooks/useCameraAccess', () => ({
  useCameraAccess: jest.fn(),
}))
jest.mock('@/src/hooks/useCameraCapture', () => ({
  useCameraCapture: jest.fn(),
}))

const requestPermission = jest.fn()
const openSettings = jest.fn()
const handleClose = jest.fn()

const gateMachine = createMachine({
  id: 'cameraGate',
  initial: 'unmounted',
  states: {
    unmounted: {
      on: {
        MOUNT_NO_PERMISSION: 'noPermission',
        MOUNT_NO_DEVICE: 'noDevice',
      },
    },
    noPermission: {
      on: { PRESS_ALLOW: 'noPermission', PRESS_OPEN_SETTINGS: 'noPermission' },
    },
    noDevice: {
      on: { PRESS_GO_BACK: 'noDevice' },
    },
  },
})

const baseCaptureResult: ReturnType<typeof useCameraCapture> = {
  device: null,
  cameraRef: { current: null },
  photoOutput: {} as never,
  capturedPhotos: [],
  flashMode: 'auto',
  isTakingPhoto: false,
  flashOverlayStyle: {},
  listRef: { current: null },
  renderItem: jest.fn(),
  keyExtractor: jest.fn(),
  handleTakePhoto: jest.fn(),
  cycleFlash: jest.fn(),
  flipCamera: jest.fn(),
  handleDone: jest.fn(),
  handleClose,
}

describe('CameraScreen permission/device gates — model-based test', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const model = createTestModel(gateMachine)

  const mount = (hasPermission: boolean, device: object | null) => {
    jest.mocked(useCameraAccess).mockReturnValue({
      hasPermission,
      requestPermission,
      openSettings,
    })
    jest.mocked(useCameraCapture).mockReturnValue({
      ...baseCaptureResult,
      device,
    })
    render(<CameraScreen />)
  }

  const testParams = {
    states: {
      unmounted: () => {
        expect(requestPermission).not.toHaveBeenCalled()
      },
      noPermission: () => {
        expect(screen.getByText('Camera Access Required')).toBeTruthy()
      },
      noDevice: () => {
        expect(screen.getByText('No Camera Found')).toBeTruthy()
      },
    },
    events: {
      MOUNT_NO_PERMISSION: () => mount(false, null),
      MOUNT_NO_DEVICE: () => mount(true, null),
      PRESS_ALLOW: () => fireEvent.press(screen.getByText('Allow Camera')),
      PRESS_OPEN_SETTINGS: () =>
        fireEvent.press(screen.getByText('Open Settings')),
      PRESS_GO_BACK: () => fireEvent.press(screen.getByText('Go Back')),
    },
  }

  const journeys = [
    {
      name: 'no camera permission shows the permission gate',
      events: [{ type: 'MOUNT_NO_PERMISSION' }],
    },
    {
      name: 'Allow Camera requests the OS permission',
      events: [{ type: 'MOUNT_NO_PERMISSION' }, { type: 'PRESS_ALLOW' }],
    },
    {
      name: 'Open Settings opens OS Settings',
      events: [
        { type: 'MOUNT_NO_PERMISSION' },
        { type: 'PRESS_OPEN_SETTINGS' },
      ],
    },
    {
      name: 'permission granted but no device shows the no-camera gate',
      events: [{ type: 'MOUNT_NO_DEVICE' }],
    },
    {
      name: 'Go Back closes the camera screen',
      events: [{ type: 'MOUNT_NO_DEVICE' }, { type: 'PRESS_GO_BACK' }],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)

      if (events.some((e) => e.type === 'PRESS_ALLOW')) {
        expect(requestPermission).toHaveBeenCalledTimes(1)
      }
      if (events.some((e) => e.type === 'PRESS_OPEN_SETTINGS')) {
        expect(openSettings).toHaveBeenCalledTimes(1)
      }
      if (events.some((e) => e.type === 'PRESS_GO_BACK')) {
        expect(handleClose).toHaveBeenCalledTimes(1)
      }
    })
  })
})
