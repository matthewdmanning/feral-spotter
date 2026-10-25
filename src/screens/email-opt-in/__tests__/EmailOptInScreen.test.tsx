import { userEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { useConsentStore } from '@/src/hooks/useConsentStore'
import EmailOptInScreen from '../index'
import consentCopy from '@/src/content/consentDisclosure.json'

const mockRouterReplace = jest.fn()

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    push: jest.fn(),
  },
}))

describe('EmailOptInScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useConsentStore.setState({ emailOptIn: false })
  })

  it('continuing without a choice keeps email off and goes to the analytics screen', async () => {
    render(<EmailOptInScreen />)

    await userEvent.press(
      screen.getByLabelText(consentCopy.emailOptIn.continueLabel),
    )

    expect(useConsentStore.getState().emailOptIn).toBe(false)
    expect(mockRouterReplace).toHaveBeenCalledWith('/analytics-consent')
  })

  it('checking the box then continuing opts in and goes to the analytics screen', async () => {
    render(<EmailOptInScreen />)

    await userEvent.press(
      screen.getByLabelText(
        `${consentCopy.emailOptIn.label}: ${consentCopy.emailOptIn.text}`,
      ),
    )
    await userEvent.press(
      screen.getByLabelText(consentCopy.emailOptIn.continueLabel),
    )

    expect(useConsentStore.getState().emailOptIn).toBe(true)
    expect(mockRouterReplace).toHaveBeenCalledWith('/analytics-consent')
  })
})
