import AsyncStorage from '@react-native-async-storage/async-storage'
import { CONSENT_VERSION, useConsentStore } from '@/src/shared/consent/useConsentStore'
import * as ui from '@/src/shared/hooks/useUIStore'
import {
  act,
  userEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { AppState, BackHandler, Platform } from 'react-native'
import React from 'react'
import ConsentScreen from '../index'
import consentCopy from '@/src/features/permissions/consent/content/consentDisclosure.json'

const mockRequestCameraPermission = jest.fn()
let mockCameraPermissionStatus: string
jest.mock('react-native-vision-camera', () => ({
  get VisionCamera() {
    return {
      requestCameraPermission: mockRequestCameraPermission,
      get cameraPermissionStatus() {
        return mockCameraPermissionStatus
      },
    }
  },
}))

const mockRequestForegroundPermissionsAsync = jest.fn()
const mockGetForegroundPermissionsAsync = jest.fn()
jest.mock('expo-location', () => ({
  ...jest.requireActual('expo-location'),
  requestForegroundPermissionsAsync: (...args: unknown[]) =>
    mockRequestForegroundPermissionsAsync(...args),
  getForegroundPermissionsAsync: (...args: unknown[]) =>
    mockGetForegroundPermissionsAsync(...args),
}))

const grantedLocation = { granted: true, android: { accuracy: 'fine' } }

const mockRouterReplace = jest.fn()
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    push: jest.fn(),
  },
}))

jest.mock('@/src/shared/hooks/useBackHandler', () => ({
  useBackHandler: jest.fn(),
}))

beforeEach(async () => {
  await useConsentStore.persist.rehydrate()
  useConsentStore.setState({
    accepted: false,
    acceptedVersion: null,
    analyticsAccepted: false,
  })
})

const expectConsentAccepted = async (accepted: boolean) => {
  const expected = {
    accepted,
    acceptedVersion: accepted ? CONSENT_VERSION : null,
  }
  expect(useConsentStore.getState()).toMatchObject(expected)
  const stored = await AsyncStorage.getItem('consent-store')
  expect(JSON.parse(stored ?? '{}').state).toMatchObject(expected)
}

describe('ConsentScreen decline flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Platform.OS = 'android'
    mockCameraPermissionStatus = 'authorized'
    // handleAgree's request path reads the boolean requestCameraPermission()
    // resolves with, not the getter — keep it in sync with the status above.
    mockRequestCameraPermission.mockImplementation(
      async () => mockCameraPermissionStatus === 'authorized',
    )
    mockRequestForegroundPermissionsAsync.mockResolvedValue(grantedLocation)
    mockGetForegroundPermissionsAsync.mockResolvedValue(grantedLocation)
  })

  it('warns before exiting instead of declining silently', async () => {
    const alertSpy = jest.spyOn(ui, 'showAlert').mockImplementation(() => {})
    render(<ConsentScreen />)

    await userEvent.press(screen.getByLabelText(consentCopy.declineLabel))

    expect(alertSpy).toHaveBeenCalledWith(
      consentCopy.declineWarningTitle,
      consentCopy.declineWarningBody,
      expect.arrayContaining([
        expect.objectContaining({ text: 'Back' }),
        expect.objectContaining({ text: 'Exit' }),
      ]),
    )
  })

  it('exits the app on Android when Exit is confirmed', async () => {
    const exitSpy = jest
      .spyOn(BackHandler, 'exitApp')
      .mockImplementation(() => {})
    jest.spyOn(ui, 'showAlert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Exit')?.onPress?.()
    })
    render(<ConsentScreen />)

    await userEvent.press(screen.getByLabelText(consentCopy.declineLabel))

    expect(exitSpy).toHaveBeenCalledTimes(1)
  })

  it('does not exit when Back is chosen', async () => {
    const exitSpy = jest
      .spyOn(BackHandler, 'exitApp')
      .mockImplementation(() => {})
    jest.spyOn(ui, 'showAlert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Back')?.onPress?.()
    })
    render(<ConsentScreen />)

    await userEvent.press(screen.getByLabelText(consentCopy.declineLabel))

    expect(exitSpy).not.toHaveBeenCalled()
  })
})

describe('ConsentScreen blocked-permission recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Platform.OS = 'android'
    mockRequestCameraPermission.mockImplementation(
      async () => mockCameraPermissionStatus === 'authorized',
    )
  })

  it('clears the blocked gate and continues once Settings grant is detected on foreground', async () => {
    mockCameraPermissionStatus = 'denied'
    mockRequestForegroundPermissionsAsync.mockResolvedValue(grantedLocation)

    let foregroundListener: ((state: string) => void) | undefined
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        foregroundListener = listener as (state: string) => void
        return { remove: jest.fn() }
      })

    render(<ConsentScreen />)
    await userEvent.press(screen.getByLabelText(consentCopy.agreeLabel))

    expect(screen.getByText('Permission Blocked')).toBeTruthy()
    // #66 relaunch-bypass reopen: consent must not be recorded while still
    // gated, or a relaunch here would skip this screen with access denied.
    await expectConsentAccepted(false)
    expect(mockRouterReplace).not.toHaveBeenCalled()

    mockCameraPermissionStatus = 'authorized'
    mockGetForegroundPermissionsAsync.mockResolvedValue(grantedLocation)

    await act(async () => {
      foregroundListener?.('active')
    })

    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith('/sign-in'),
    )
    await expectConsentAccepted(true)
    expect(screen.queryByText('Permission Blocked')).toBeNull()
  })
})

describe('ConsentScreen location one-time-grant notice (#225)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Platform.OS = 'android'
    mockCameraPermissionStatus = 'authorized'
    mockRequestCameraPermission.mockImplementation(
      async () => mockCameraPermissionStatus === 'authorized',
    )
  })

  it('surfaces the convenience-tradeoff notice on a fresh location grant', async () => {
    const alertSpy = jest.spyOn(ui, 'showAlert').mockImplementation(() => {})
    mockRequestForegroundPermissionsAsync.mockResolvedValue(grantedLocation)
    render(<ConsentScreen />)

    await userEvent.press(screen.getByLabelText(consentCopy.agreeLabel))

    expect(alertSpy).toHaveBeenCalledWith(
      consentCopy.locationOnceWarningTitle,
      consentCopy.locationOnceWarningBody,
    )
    // No gate — proceeds normally after the notice, same as any other grant.
    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith('/sign-in'),
    )
    await expectConsentAccepted(true)
  })

  it('does not show the notice when access is granted via Settings recovery', async () => {
    const alertSpy = jest.spyOn(ui, 'showAlert').mockImplementation(() => {})
    mockCameraPermissionStatus = 'denied'
    mockRequestForegroundPermissionsAsync.mockResolvedValue(grantedLocation)

    let foregroundListener: ((state: string) => void) | undefined
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        foregroundListener = listener as (state: string) => void
        return { remove: jest.fn() }
      })

    render(<ConsentScreen />)
    await userEvent.press(screen.getByLabelText(consentCopy.agreeLabel))
    expect(screen.getByText('Permission Blocked')).toBeTruthy()
    expect(mockRouterReplace).not.toHaveBeenCalled()
    await expectConsentAccepted(false)

    mockCameraPermissionStatus = 'authorized'
    mockGetForegroundPermissionsAsync.mockResolvedValue(grantedLocation)
    await act(async () => {
      foregroundListener?.('active')
    })

    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith('/sign-in'),
    )
    expect(alertSpy).not.toHaveBeenCalledWith(
      consentCopy.locationOnceWarningTitle,
      expect.anything(),
    )
    await expectConsentAccepted(true)
    expect(screen.queryByText('Permission Blocked')).toBeNull()
  })
})
