import { userEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import EmailOptInScreen from '../index'
import consentCopy from '@/src/features/permissions/consent/content/consentDisclosure.json'

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
    useConsentStore.setState({ emailOptIn: null })
    useAuthStore.setState({ user: { uid: 'u', email: 'jane@example.com' } })
  })

  it('shows the account address masked', () => {
    render(<EmailOptInScreen />)

    expect(screen.getByText('Updates go to j***@example.com.')).toBeTruthy()
    expect(screen.queryByText(/jane@example\.com/)).toBeNull()
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
