import * as ui from '@/src/hooks/useUIStore'
import {
  userEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { BackHandler, Platform } from 'react-native'
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

describe('IntroFlowScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    backHandler = undefined
    Platform.OS = 'android'
  })

  it('shows each slide, returns with Previous, and advances to /consent', async () => {
    const user = userEvent.setup()
    render(<IntroFlowScreen />)

    const expectSlide = (index: number) => {
      const slide = ONBOARDING_SLIDES[index]
      expect(screen.getByRole('header', { name: slide.header })).toBeVisible()
      for (const paragraph of slide.body) {
        expect(screen.getByText(paragraph)).toBeVisible()
      }
      if (index === 0) {
        expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
      } else {
        expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()
      }
    }

    expectSlide(0)
    for (let index = 0; index < ONBOARDING_SLIDES.length; index++) {
      await user.press(screen.getByText(ONBOARDING_SLIDES[index].button))
      if (index + 1 < ONBOARDING_SLIDES.length) expectSlide(index + 1)
      if (index === 1) {
        await user.press(screen.getByRole('button', { name: 'Previous' }))
        expectSlide(1)
        await user.press(screen.getByText(ONBOARDING_SLIDES[1].button))
        expectSlide(2)
      }
    }

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/consent'))
  })

  it('links to /data-agreement from the data-usage slide', async () => {
    render(<IntroFlowScreen />)
    // Advance to the data-usage slide (index 2)
    await userEvent.press(screen.getByText(ONBOARDING_SLIDES[0].button))
    await userEvent.press(screen.getByText(ONBOARDING_SLIDES[1].button))

    await userEvent.press(screen.getByRole('link'))
    expect(router.push).toHaveBeenCalledWith('/data-agreement')
  })

  it('warns before exiting on hardware back at T1', () => {
    const alertSpy = jest.spyOn(ui, 'showAlert').mockImplementation(() => {})
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
    jest.spyOn(ui, 'showAlert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.text === 'Exit')?.onPress?.()
    })
    render(<IntroFlowScreen />)

    backHandler?.()

    expect(exitSpy).toHaveBeenCalledTimes(1)
  })

  it('does not intercept hardware back past T1', async () => {
    const alertSpy = jest.spyOn(ui, 'showAlert').mockImplementation(() => {})
    render(<IntroFlowScreen />)
    await userEvent.press(screen.getByText(ONBOARDING_SLIDES[0].button))

    const swallowed = backHandler?.()

    expect(swallowed).toBe(false)
    expect(alertSpy).not.toHaveBeenCalled()
  })
})
