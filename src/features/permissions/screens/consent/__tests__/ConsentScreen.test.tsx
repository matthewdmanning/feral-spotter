import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  CONSENT_VERSION,
  useConsentStore,
} from '@/src/shared/consent/useConsentStore'
import * as ui from '@/src/shared/hooks/useUIStore'
import {
  userEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { BackHandler, Platform } from 'react-native'
import React from 'react'
import ConsentScreen from '@/src/features/permissions/screens/consent/index'
import consentCopy from '@/src/features/permissions/copy/consentDisclosure.json'
import { pressDialogButton } from '@/src/test-utils/dialog'

const mockRequestCameraPermission = jest.fn()
jest.mock('react-native-vision-camera', () => ({
  get VisionCamera() {
    return { requestCameraPermission: mockRequestCameraPermission }
  },
}))

const mockRequestForegroundPermissionsAsync = jest.fn()
jest.mock('expo-location', () => ({
  ...jest.requireActual('expo-location'),
  requestForegroundPermissionsAsync: (...args: unknown[]) =>
    mockRequestForegroundPermissionsAsync(...args),
}))

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
  Platform.OS = 'android'
  await useConsentStore.persist.rehydrate()
  useConsentStore.setState({
    accepted: false,
    acceptedVersion: null,
    analyticsAccepted: false,
  })
})

describe('ConsentScreen agree flow', () => {
  // Apple HIG and App Review 5.1.1(iv): the disclosure must not ask for, or
  // depend on, camera or location. Those are asked where they are used.
  it('records consent and moves on without asking for any OS permission', async () => {
    await render(<ConsentScreen />)

    await userEvent.press(screen.getByLabelText(consentCopy.agreeLabel))

    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith('/sign-in'),
    )
    const expected = { accepted: true, acceptedVersion: CONSENT_VERSION }
    expect(useConsentStore.getState()).toMatchObject(expected)
    const stored = await AsyncStorage.getItem('consent-store')
    expect(JSON.parse(stored ?? '{}').state).toMatchObject(expected)
    expect(mockRequestCameraPermission).not.toHaveBeenCalled()
    expect(mockRequestForegroundPermissionsAsync).not.toHaveBeenCalled()
  })
})

describe('ConsentScreen decline flow', () => {
  it('warns before exiting instead of declining silently', async () => {
    const alertSpy = jest.spyOn(ui, 'showAlert').mockImplementation(() => {})
    await render(<ConsentScreen />)

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
    await render(<ConsentScreen />)

    await userEvent.press(screen.getByLabelText(consentCopy.declineLabel))
    await pressDialogButton('Exit')

    expect(exitSpy).toHaveBeenCalledTimes(1)
  })

  it('does not exit when Back is chosen', async () => {
    const exitSpy = jest
      .spyOn(BackHandler, 'exitApp')
      .mockImplementation(() => {})
    await render(<ConsentScreen />)

    await userEvent.press(screen.getByLabelText(consentCopy.declineLabel))
    await pressDialogButton('Back')

    expect(exitSpy).not.toHaveBeenCalled()
  })
})
