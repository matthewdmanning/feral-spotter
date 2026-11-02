import { nextConsentRoute, routeAfterDeviceConsent } from '../consentFlow'
import { useAuthStore } from '@/src/lib/auth/authStore'
import { useConsentStore } from '../useConsentStore'

describe('nextConsentRoute', () => {
  beforeEach(() =>
    useConsentStore.setState({ emailOptIn: null, analyticsAccepted: null }),
  )

  it('starts with the email step for a user who has not chosen', () => {
    expect(nextConsentRoute()).toBe('/email-opt-in')
  })

  it.each([true, false])(
    'skips the email step once the user chose %s',
    (emailOptIn) => {
      useConsentStore.setState({ emailOptIn })
      expect(nextConsentRoute()).toBe('/analytics-consent')
    },
  )

  it('goes email → analytics → home', () => {
    expect(nextConsentRoute('/email-opt-in')).toBe('/analytics-consent')
    expect(nextConsentRoute('/analytics-consent')).toBe('/(home-tabs)')
  })
})

describe('nextConsentRoute with the analytics step answered', () => {
  it.each([true, false])('skips the analytics step once chosen %s', (v) => {
    useConsentStore.setState({ emailOptIn: true, analyticsAccepted: v })
    expect(nextConsentRoute()).toBe('/(home-tabs)')
  })
})

// Re-accepting the disclosure after a CONSENT_VERSION bump used to send a
// signed-in user to /sign-in, asking for credentials their session did not
// need.
describe('routeAfterDeviceConsent', () => {
  afterEach(() => useAuthStore.setState({ user: null }))

  it('sends a signed-out user to sign-in', () => {
    useAuthStore.setState({ user: null })
    expect(routeAfterDeviceConsent()).toBe('/sign-in')
  })

  it('sends a signed-in user on to their next consent step or home', () => {
    useAuthStore.setState({ user: { uid: 'u1' } as never })
    useConsentStore.setState({ emailOptIn: null, analyticsAccepted: null })
    expect(routeAfterDeviceConsent()).toBe('/email-opt-in')
    useConsentStore.setState({ emailOptIn: false, analyticsAccepted: false })
    expect(routeAfterDeviceConsent()).toBe('/(home-tabs)')
  })
})
