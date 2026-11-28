import { userEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'
import AnalyticsConsentScreen from '@/src/features/permissions/screens/analytics-consent/index'
import consentCopy from '@/src/features/permissions/copy/consentDisclosure.json'

const mockRouterReplace = jest.fn()
const mockRouterDismissTo = jest.fn()

jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    dismissTo: (...args: unknown[]) => mockRouterDismissTo(...args),
    push: jest.fn(),
  },
}))

describe('AnalyticsConsentScreen', () => {
  beforeEach(() => {
    useConsentStore.setState({ analyticsAccepted: false })
  })

  it('toggling the checkbox off then continuing disables analytics and returns to Home', async () => {
    useConsentStore.setState({ analyticsAccepted: true })
    await render(<AnalyticsConsentScreen />)

    await userEvent.press(
      screen.getByLabelText(
        `${consentCopy.analytics.label}: ${consentCopy.analytics.text}`,
      ),
    )
    await userEvent.press(
      screen.getByLabelText(consentCopy.analytics.continueLabel),
    )

    expect(useConsentStore.getState().analyticsAccepted).toBe(false)
    // Pops back to tabs a resumed step was pushed over (#495).
    expect(mockRouterDismissTo).toHaveBeenCalledWith('/')
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })

  it('leaving the checkbox checked (default) and continuing enables analytics and returns to Home', async () => {
    await render(<AnalyticsConsentScreen />)

    await userEvent.press(
      screen.getByLabelText(consentCopy.analytics.continueLabel),
    )

    expect(useConsentStore.getState().analyticsAccepted).toBe(true)
    // Pops back to tabs a resumed step was pushed over (#495).
    expect(mockRouterDismissTo).toHaveBeenCalledWith('/')
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })
})
