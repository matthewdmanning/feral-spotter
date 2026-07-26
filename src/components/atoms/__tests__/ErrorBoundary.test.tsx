import { render } from '@testing-library/react-native'
import React from 'react'
import { ErrorBoundary } from '../ErrorBoundary'
import { registerCaptureException } from '@/src/lib/analytics/analytics'

const consentState = { accepted: false, analyticsAccepted: false }

jest.mock('@/src/hooks/useConsentStore', () => ({
  hasAcceptedConsent: () => consentState.accepted,
  hasAcceptedAnalytics: () => consentState.analyticsAccepted,
}))

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native')
  return { AlertCircle: () => <View /> }
})

jest.mock('react-native-unistyles', () => {
  const theme = {
    colors: { background: '#fff', text: '#000', muted: '#888', border: '#ccc', accent: '#00f', accentText: '#fff', surface: '#fff', surfaceAlt: '#eee' },
    spacing: { xs: 2, sm: 4, md: 8, lg: 16, xl: 24, xxl: 32, xxxl: 40 },
    typography: { xs: 10, sm: 12, base: 16, xl: 20, xxl: 24 },
    radius: { sm: 4, md: 8, lg: 12, xl: 16 },
  }
  return {
    StyleSheet: { create: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn) },
  }
})

function Boom(): null {
  throw new Error('kaboom')
}

describe('ErrorBoundary crash reporting', () => {
  const captureExceptionSpy = jest.fn()

  beforeEach(() => {
    captureExceptionSpy.mockClear()
    registerCaptureException(captureExceptionSpy)
    consentState.accepted = false
    consentState.analyticsAccepted = false
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('does not report the crash before consent and analytics opt-in are both accepted', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(captureExceptionSpy).not.toHaveBeenCalled()
  })

  it('reports the crash with the component stack once consent and analytics are accepted', () => {
    consentState.accepted = true
    consentState.analyticsAccepted = true

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(captureExceptionSpy).toHaveBeenCalledTimes(1)
    const [error, extra] = captureExceptionSpy.mock.calls[0] as [Error, { component_stack?: string }]
    expect(error.message).toBe('kaboom')
    expect(extra?.component_stack).toEqual(expect.stringContaining('Boom'))
  })
})
