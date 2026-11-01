import { nextConsentRoute } from '@/src/shared/consent/consentFlow'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'

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
