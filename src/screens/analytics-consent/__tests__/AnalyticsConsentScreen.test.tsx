import { userEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'
import AnalyticsConsentScreen from '../index'
import consentCopy from '@/src/features/permissions/consent/content/consentDisclosure.json'

const mockRouterReplace = jest.fn()

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    push: jest.fn(),
  },
}))

describe('AnalyticsConsentScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useConsentStore.setState({ analyticsAccepted: false })
  })

  it('toggling the checkbox off then continuing disables analytics and navigates to /(home-tabs)', async () => {
    useConsentStore.setState({ analyticsAccepted: true })
    render(<AnalyticsConsentScreen />)

    await userEvent.press(
      screen.getByLabelText(
        `${consentCopy.analytics.label}: ${consentCopy.analytics.text}`,
      ),
    )
    await userEvent.press(
      screen.getByLabelText(consentCopy.analytics.continueLabel),
    )

    expect(useConsentStore.getState().analyticsAccepted).toBe(false)
    expect(mockRouterReplace).toHaveBeenCalledWith('/(home-tabs)')
  })

  it('leaving the checkbox checked (default) and continuing enables analytics and navigates to /(home-tabs)', async () => {
    render(<AnalyticsConsentScreen />)

    await userEvent.press(
      screen.getByLabelText(consentCopy.analytics.continueLabel),
    )

    expect(useConsentStore.getState().analyticsAccepted).toBe(true)
    expect(mockRouterReplace).toHaveBeenCalledWith('/(home-tabs)')
  })
})
