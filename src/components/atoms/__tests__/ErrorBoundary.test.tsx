import { render } from '@testing-library/react-native'
import React from 'react'
import { ErrorBoundary } from '../ErrorBoundary'
import { registerCaptureException } from '@/src/lib/analytics/analytics'
import { useConsentStore } from '@/src/hooks/useConsentStore'

function Boom(): null {
  throw new Error('kaboom')
}

describe('ErrorBoundary crash reporting', () => {
  const captureExceptionSpy = jest.fn()

  beforeEach(() => {
    captureExceptionSpy.mockClear()
    registerCaptureException(captureExceptionSpy)
    useConsentStore.setState(useConsentStore.getInitialState())
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.each([
    { accepted: false, analyticsAccepted: false },
    { accepted: true, analyticsAccepted: false },
    { accepted: false, analyticsAccepted: true },
  ])(
    'does not report the crash with consent state %p',
    ({ accepted, analyticsAccepted }) => {
      if (accepted) useConsentStore.getState().markAccepted()
      useConsentStore.getState().setAnalyticsAccepted(analyticsAccepted)
      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      )

      expect(captureExceptionSpy).not.toHaveBeenCalled()
    },
  )

  it('reports the crash with the component stack once consent and analytics are accepted', () => {
    useConsentStore.getState().markAccepted()
    useConsentStore.getState().setAnalyticsAccepted(true)

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(captureExceptionSpy).toHaveBeenCalledTimes(1)
    const [error, extra] = captureExceptionSpy.mock.calls[0] as [
      Error,
      { component_stack?: string },
    ]
    expect(error.message).toBe('kaboom')
    expect(extra?.component_stack).toEqual(expect.stringContaining('Boom'))
  })
})
