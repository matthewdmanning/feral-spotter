import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { Alert, BackHandler, Platform } from 'react-native'
import { router } from 'expo-router'
import React from 'react'
import {
  EXIT_WARNING_BODY,
  EXIT_WARNING_TITLE,
  ONBOARDING_SLIDES,
} from '@/src/config/introFlowCopy'
import IntroFlowScreen from '../index'

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}))

let backHandler: (() => boolean) | undefined
jest.mock('@/src/hooks/useBackHandler', () => ({
  useBackHandler: (handler: () => boolean) => {
    backHandler = handler
  },
}))

jest.mock('@/src/components/atoms/AppButton', () => {
  const { Pressable, Text } = require('react-native')
  return {
    AppButton: ({
      onPress,
      children,
    }: {
      onPress: () => void
      children: string
    }) => (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={children}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
  }
})

describe('IntroFlowScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    backHandler = undefined
    Platform.OS = 'android'
  })

  it('shows the first slide and advances through all of them to /consent', async () => {
    render(<IntroFlowScreen />)
    expect(screen.getByText(ONBOARDING_SLIDES[0].header)).toBeTruthy()

    for (const slide of ONBOARDING_SLIDES) {
      fireEvent.press(screen.getByText(slide.button))
    }

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/consent'))
  })

  it('links to /data-agreement from the data-usage slide', () => {
    render(<IntroFlowScreen />)
    // Advance to the data-usage slide (index 2)
    fireEvent.press(screen.getByText(ONBOARDING_SLIDES[0].button))
    fireEvent.press(screen.getByText(ONBOARDING_SLIDES[1].button))

    fireEvent.press(screen.getByRole('link'))
    expect(router.push).toHaveBeenCalledWith('/data-agreement')
  })

  it('warns before exiting on hardware back at T1', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    render(<IntroFlowScreen />)

    const swallowed = backHandler?.()

    expect(swallowed).toBe(true)
    expect(alertSpy).toHaveBeenCalledWith(
      EXIT_WARNING_TITLE,
      EXIT_WARNING_BODY,
      expect.arrayContaining([
        expect.objectContaining({ text: 'Back' }),
        expect.objectContaining({ text: 'Exit' }),
      ]),
    )
  })

  it('exits the app on Android when Exit is confirmed at T1', () => {
    const exitSpy = jest
      .spyOn(BackHandler, 'exitApp')
      .mockImplementation(() => {})
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Exit')?.onPress?.()
    })
    render(<IntroFlowScreen />)

    backHandler?.()

    expect(exitSpy).toHaveBeenCalledTimes(1)
  })

  it('does not intercept hardware back past T1', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    render(<IntroFlowScreen />)
    fireEvent.press(screen.getByText(ONBOARDING_SLIDES[0].button))

    const swallowed = backHandler?.()

    expect(swallowed).toBe(false)
    expect(alertSpy).not.toHaveBeenCalled()
  })
})
