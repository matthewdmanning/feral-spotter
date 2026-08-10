import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { Alert, AppState, BackHandler, Platform } from 'react-native'
import React from 'react'
import ConsentScreen from '../index'
import consentCopy from '@/src/content/consentDisclosure.json'

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

const mockMarkAccepted = jest.fn()
jest.mock('@/src/hooks/useConsentStore', () => ({
  useConsentStore: (sel: (s: object) => unknown) =>
    sel({ markAccepted: mockMarkAccepted }),
}))

jest.mock('@/src/hooks/useBackHandler', () => ({
  useBackHandler: jest.fn(),
}))

jest.mock('react-native-unistyles', () => {
  const theme = {
    colors: {
      background: '#fff',
      text: '#000',
      muted: '#888',
      border: '#ccc',
      accent: '#00f',
      accentText: '#fff',
      surfaceAlt: '#eee',
      danger: '#f00',
    },
    spacing: { xs: 2, sm: 4, md: 8, lg: 16, xl: 24, xxl: 32, xxxl: 40 },
    typography: { sm: 12, base: 16, xl: 20, xxl: 24 },
    radius: { sm: 4, md: 8, lg: 12 },
  }
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn),
    },
  }
})

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

  it('warns before exiting instead of declining silently', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    render(<ConsentScreen />)

    fireEvent.press(screen.getByLabelText(consentCopy.declineLabel))

    expect(alertSpy).toHaveBeenCalledWith(
      consentCopy.declineWarningTitle,
      consentCopy.declineWarningBody,
      expect.arrayContaining([
        expect.objectContaining({ text: 'Back' }),
        expect.objectContaining({ text: 'Exit' }),
      ]),
    )
  })

  it('exits the app on Android when Exit is confirmed', () => {
    const exitSpy = jest
      .spyOn(BackHandler, 'exitApp')
      .mockImplementation(() => {})
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Exit')?.onPress?.()
    })
    render(<ConsentScreen />)

    fireEvent.press(screen.getByLabelText(consentCopy.declineLabel))

    expect(exitSpy).toHaveBeenCalledTimes(1)
  })

  it('does not exit when Back is chosen', () => {
    const exitSpy = jest
      .spyOn(BackHandler, 'exitApp')
      .mockImplementation(() => {})
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Back')?.onPress?.()
    })
    render(<ConsentScreen />)

    fireEvent.press(screen.getByLabelText(consentCopy.declineLabel))

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
    await act(async () => {
      fireEvent.press(screen.getByLabelText(consentCopy.agreeLabel))
    })

    expect(screen.getByText('Permission Blocked')).toBeTruthy()
    // #66 relaunch-bypass reopen: consent must not be recorded while still
    // gated, or a relaunch here would skip this screen with access denied.
    expect(mockMarkAccepted).not.toHaveBeenCalled()

    mockCameraPermissionStatus = 'authorized'
    mockGetForegroundPermissionsAsync.mockResolvedValue(grantedLocation)

    await act(async () => {
      foregroundListener?.('active')
    })

    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith('/sign-in'),
    )
    expect(mockMarkAccepted).toHaveBeenCalled()
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
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockRequestForegroundPermissionsAsync.mockResolvedValue(grantedLocation)
    render(<ConsentScreen />)

    await act(async () => {
      fireEvent.press(screen.getByLabelText(consentCopy.agreeLabel))
    })

    expect(alertSpy).toHaveBeenCalledWith(
      consentCopy.locationOnceWarningTitle,
      consentCopy.locationOnceWarningBody,
    )
    // No gate — proceeds normally after the notice, same as any other grant.
    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith('/sign-in'),
    )
  })

  it('does not show the notice when access is granted via Settings recovery', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
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
    await act(async () => {
      fireEvent.press(screen.getByLabelText(consentCopy.agreeLabel))
    })

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
  })
})
