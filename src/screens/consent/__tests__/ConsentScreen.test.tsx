import { fireEvent, render, screen } from '@testing-library/react-native'
import { Alert, BackHandler, Platform } from 'react-native'
import React from 'react'
import ConsentScreen from '../index'
import consentCopy from '@/src/content/consentDisclosure.json'

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}))

jest.mock('@/src/hooks/useConsentStore', () => ({
  useConsentStore: (sel: (s: object) => unknown) => sel({ markAccepted: jest.fn() }),
}))

jest.mock('@/src/hooks/useBackHandler', () => ({
  useBackHandler: jest.fn(),
}))

jest.mock('react-native-unistyles', () => {
  const theme = {
    colors: { background: '#fff', text: '#000', muted: '#888', border: '#ccc', accent: '#00f', accentText: '#fff', surfaceAlt: '#eee', danger: '#f00' },
    spacing: { xs: 2, sm: 4, md: 8, lg: 16, xl: 24, xxl: 32, xxxl: 40 },
    typography: { sm: 12, base: 16, xl: 20, xxl: 24 },
    radius: { sm: 4, md: 8, lg: 12 },
  }
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: { create: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn) },
  }
})

describe('ConsentScreen decline flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Platform.OS = 'android'
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
    const exitSpy = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => {})
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Exit')?.onPress?.()
    })
    render(<ConsentScreen />)

    fireEvent.press(screen.getByLabelText(consentCopy.declineLabel))

    expect(exitSpy).toHaveBeenCalledTimes(1)
  })

  it('does not exit when Back is chosen', () => {
    const exitSpy = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => {})
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Back')?.onPress?.()
    })
    render(<ConsentScreen />)

    fireEvent.press(screen.getByLabelText(consentCopy.declineLabel))

    expect(exitSpy).not.toHaveBeenCalled()
  })
})
