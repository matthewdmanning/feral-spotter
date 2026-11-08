import * as ui from '@/src/shared/hooks/useUIStore'
import {
  act,
  userEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { BackHandler, Platform } from 'react-native'
import { router } from 'expo-router'
import React from 'react'
import introFlowCopy from '@/src/features/permissions/copy/introFlowCopy.json'
import IntroFlowScreen from '@/src/features/permissions/screens/intro-flow/index'
import { pressDialogButton } from '@/src/test-utils/dialog'

const { slides, exitWarningTitle, exitWarningBody } = introFlowCopy

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}))

let backHandler: (() => boolean) | undefined
jest.mock('@/src/shared/hooks/useBackHandler', () => ({
  useBackHandler: (handler: () => boolean) => {
    backHandler = handler
  },
}))

describe('IntroFlowScreen', () => {
  beforeEach(() => {
    backHandler = undefined
    Platform.OS = 'android'
  })

  it('shows each slide, returns with Previous, and advances to /consent', async () => {
    const user = userEvent.setup()
    render(<IntroFlowScreen />)

    const expectSlide = (index: number) => {
      const slide = slides[index]
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
    for (let index = 0; index < slides.length; index++) {
      await user.press(screen.getByText(slides[index].button))
      if (index + 1 < slides.length) expectSlide(index + 1)
      if (index === 1) {
        await user.press(screen.getByRole('button', { name: 'Previous' }))
        expectSlide(1)
        await user.press(screen.getByText(slides[1].button))
        expectSlide(2)
      }
    }

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/consent'))
  })

  it('links to /data-agreement from the data-usage slide', async () => {
    render(<IntroFlowScreen />)
    // Advance to the data-usage slide (index 2)
    await userEvent.press(screen.getByText(slides[0].button))
    await userEvent.press(screen.getByText(slides[1].button))

    await userEvent.press(screen.getByRole('link'))
    expect(router.push).toHaveBeenCalledWith('/data-agreement')
  })

  it('warns before exiting on hardware back at T1', () => {
    const alertSpy = jest.spyOn(ui, 'showAlert').mockImplementation(() => {})
    render(<IntroFlowScreen />)

    const swallowed = backHandler?.()

    expect(swallowed).toBe(true)
    expect(alertSpy).toHaveBeenCalledWith(
      exitWarningTitle,
      exitWarningBody,
      expect.arrayContaining([
        expect.objectContaining({ text: 'Back' }),
        expect.objectContaining({ text: 'Exit' }),
      ]),
    )
  })

  it('exits the app on Android when Exit is confirmed at T1', async () => {
    const exitSpy = jest
      .spyOn(BackHandler, 'exitApp')
      .mockImplementation(() => {})
    render(<IntroFlowScreen />)

    backHandler?.()
    await pressDialogButton('Exit')

    expect(exitSpy).toHaveBeenCalledTimes(1)
  })

  // Slides are local state on the only stack entry: an unhandled Back past
  // T1 used to exit the app with no confirm.
  it('steps back one slide on hardware back past T1', async () => {
    const alertSpy = jest.spyOn(ui, 'showAlert').mockImplementation(() => {})
    render(<IntroFlowScreen />)
    await userEvent.press(screen.getByText(slides[0].button))
    expect(screen.getByText(slides[1].header)).toBeTruthy()

    let swallowed: boolean | undefined
    act(() => {
      swallowed = backHandler?.()
    })

    expect(swallowed).toBe(true)
    expect(alertSpy).not.toHaveBeenCalled()
    expect(screen.getByText(slides[0].header)).toBeTruthy()
  })
})
