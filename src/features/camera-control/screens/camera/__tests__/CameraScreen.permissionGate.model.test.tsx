import { userEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { Linking } from 'react-native'
import { useCameraPermission } from 'react-native-vision-camera'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { useCameraCapture } from '@/src/features/camera-control/hooks/useCameraCapture'
import CameraScreen from '@/src/features/camera-control/screens/camera/index'

/**
 * Model of CameraScreen's (src/features/camera-control/screens/camera/index.tsx) two gate screens —
 * logic that lives directly in the screen's JSX, not delegated to a hook, and
 * has no coverage anywhere else. The main capture view's buttons (shutter,
 * flip, flash, close, done) are thin onPress={handler} wiring onto
 * useCameraCapture, which already has direct handler-level coverage
 * (useCameraCapture.test.ts, useCameraCapture.controls.model.test.ts) —
 * re-testing that wiring through a full react-native-vision-camera render
 * would duplicate that coverage without adding real assurance.
 *
 * Permission timing follows Apple HIG: a first open asks the OS at once, with
 * no pre-prompt. The gate then offers one Continue button while the OS can
 * still ask, and only Settings once it cannot.
 */
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}))

jest.mock('react-native-vision-camera', () => ({
  Camera: 'Camera',
  useCameraPermission: jest.fn(),
}))
jest.mock('@shopify/flash-list', () => ({ FlashList: 'FlashList' }))
// This branch's NativeCameraScreen reaches expo-media-library through
// useNativeCameraCapture -> gallerySavePermission. The real module extends a
// native class, which fails to construct under Jest, so the whole suite could
// not load. Same shape as the camera hook suites' mock.
jest.mock('expo-media-library', () => ({
  get Asset() {
    return { create: jest.fn() }
  },
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
}))
jest.mock('@/src/features/camera-control/hooks/useCameraCapture', () => ({
  useCameraCapture: jest.fn(),
}))

const requestPermission = jest.fn()
const handleClose = jest.fn()

const gateMachine = createMachine({
  id: 'cameraGate',
  initial: 'unmounted',
  states: {
    unmounted: {
      on: {
        MOUNT_FIRST_OPEN: 'firstOpen',
        MOUNT_BLOCKED: 'blocked',
        MOUNT_NO_DEVICE: 'noDevice',
      },
    },
    firstOpen: {
      on: { PRESS_CONTINUE: 'firstOpen' },
    },
    blocked: {
      on: { PRESS_OPEN_SETTINGS: 'blocked' },
    },
    noDevice: {
      on: { PRESS_GO_BACK: 'noDevice' },
    },
  },
})

const baseCaptureResult: ReturnType<typeof useCameraCapture> = {
  device: undefined,
  cameraRef: { current: null },
  photoOutput: {} as never,
  isActive: true,
  enableLowLightBoost: false,
  captureMode: 'single',
  handleCameraConfigured: jest.fn(),
  setCaptureMode: jest.fn(),
  capturedPhotos: [],
  canCapture: true,
  flashMode: 'auto',
  isTakingPhoto: false,
  flashOverlayStyle: {} as never,
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
    jest.spyOn(Linking, 'openSettings').mockResolvedValue()
  })

  const model = createTestModel(gateMachine)

  const mount = async (
    status: 'authorized' | 'not-determined' | 'denied',
    device: ReturnType<typeof useCameraCapture>['device'],
  ) => {
    jest.mocked(useCameraPermission).mockReturnValue({
      hasPermission: status === 'authorized',
      requestPermission,
      status,
      canRequestPermission: status === 'not-determined',
    })
    jest.mocked(useCameraCapture).mockReturnValue({
      ...baseCaptureResult,
      device,
    })
    await render(<CameraScreen />)
  }

  const testParams = {
    states: {
      unmounted: () => {
        expect(requestPermission).not.toHaveBeenCalled()
      },
      firstOpen: () => {
        expect(screen.getByText('Camera Access Required')).toBeTruthy()
        expect(screen.getByText('Continue')).toBeTruthy()
        expect(screen.queryByText('Open Settings')).toBeNull()
      },
      blocked: () => {
        expect(screen.getByText('Camera Access Required')).toBeTruthy()
        expect(screen.getByText('Open Settings')).toBeTruthy()
        expect(screen.queryByText('Continue')).toBeNull()
      },
      noDevice: () => {
        expect(screen.getByText('No Camera Found')).toBeTruthy()
      },
    },
    events: {
      MOUNT_FIRST_OPEN: () => mount('not-determined', undefined),
      MOUNT_BLOCKED: () => mount('denied', undefined),
      MOUNT_NO_DEVICE: () => mount('authorized', undefined),
      PRESS_CONTINUE: async () =>
        await userEvent.press(screen.getByText('Continue')),
      PRESS_OPEN_SETTINGS: async () =>
        await userEvent.press(screen.getByText('Open Settings')),
      PRESS_GO_BACK: async () =>
        await userEvent.press(screen.getByText('Go Back')),
    },
  }

  const journeys = [
    {
      name: 'A first open asks the OS at once, without a pre-prompt',
      events: [{ type: 'MOUNT_FIRST_OPEN' }],
      requests: 1,
    },
    {
      name: 'Continue asks the OS again while it still can',
      events: [{ type: 'MOUNT_FIRST_OPEN' }, { type: 'PRESS_CONTINUE' }],
      requests: 2,
    },
    {
      name: 'Once the OS cannot ask, only Settings is offered',
      events: [{ type: 'MOUNT_BLOCKED' }, { type: 'PRESS_OPEN_SETTINGS' }],
      requests: 0,
    },
    {
      name: 'Go Back closes the camera screen',
      events: [{ type: 'MOUNT_NO_DEVICE' }, { type: 'PRESS_GO_BACK' }],
    },
  ]

  journeys.forEach(({ name, events, requests = 0 }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)

      expect(requestPermission).toHaveBeenCalledTimes(requests)
      if (events.some((e) => e.type === 'PRESS_OPEN_SETTINGS')) {
        expect(Linking.openSettings).toHaveBeenCalledTimes(1)
      }
      if (events.some((e) => e.type === 'PRESS_GO_BACK')) {
        expect(handleClose).toHaveBeenCalledTimes(1)
      }
    })
  })
})
