import { act, screen, userEvent } from '@testing-library/react-native'
import { Stack, router } from 'expo-router'
import { renderRouter } from 'expo-router/testing-library'
import { BackHandler, Platform, Text } from 'react-native'
import IntroFlowScreen from '@/src/features/permissions/screens/intro-flow'
import DataAgreementScreen from '@/src/features/permissions/screens/dataAgreement'
import introFlowCopy from '@/src/features/permissions/copy/introFlowCopy.json'
import consentCopy from '@/src/features/permissions/copy/consentDisclosure.json'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import { setConsent } from '@/src/test-utils/consent'

/**
 * Flow: Data Agreement Back and Deny (NAV-1)
 * A first-run user on Onboarding's data slide opens the Data Agreement and
 * presses Android Back. Onboarding stayed mounted underneath and swallowed
 * every Back, stepping its hidden slides instead. Now the agreement ignores
 * the first Back and declines on the second, like Consent's Decline. A
 * consented user who opens it from Settings simply goes back.
 *
 * States:
 * - Onboarding, data slide: slide 3 shown; agreement link visible.
 * - Data Agreement: agreement over Onboarding; Deny shown before consent.
 * - Decline warning: "Permissions Required" dialog over the agreement.
 * - Settings: the previous screen, for a consented user.
 * Events: tap Next, tap the agreement link, press Back, tap Deny.
 */

// Android's last-registered-first dispatch, over every real subscriber
// (the navigator's own included).
const backHandlers: (() => boolean | null | undefined)[] = []
async function pressBack() {
  await act(async () => {
    for (let i = backHandlers.length - 1; i >= 0; i--)
      if (backHandlers[i]()) return
  })
}

beforeEach(() => {
  backHandlers.length = 0
  jest.replaceProperty(Platform, 'OS', 'android')
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, h) => {
    const handler = h as () => boolean
    backHandlers.push(handler)
    return {
      remove: () => {
        const index = backHandlers.indexOf(handler)
        if (index >= 0) backHandlers.splice(index, 1)
      },
    }
  })
})

const routes = {
  _layout: () => <Stack />,
  'intro-flow': IntroFlowScreen,
  'data-agreement': DataAgreementScreen,
  settings: () => <Text>Settings</Text>,
}
const dataSlide = introFlowCopy.slides[2]

async function openFromOnboarding() {
  setConsent(false)
  await renderRouter(routes, { initialUrl: '/intro-flow' })
  const user = userEvent.setup()
  await user.press(screen.getByText(introFlowCopy.slides[0].button))
  await user.press(screen.getByText(introFlowCopy.slides[1].button))
  await user.press(screen.getByText(introFlowCopy.dataAgreementLinkLabel))
  expect(screen.getByText(consentCopy.title)).toBeTruthy()
  return user
}

it('ignores the first Back, then declines on the second', async () => {
  await openFromOnboarding()

  await pressBack()
  expect(screen.getByText(consentCopy.denyLabel)).toBeTruthy()
  expect(useUIStore.getState().dialog).toBeNull()

  await pressBack()
  expect(useUIStore.getState().dialog?.title).toBe(
    consentCopy.declineWarningTitle,
  )
  // Onboarding underneath never moved off its data slide.
  await act(async () => router.back())
  expect(screen.getByText(dataSlide.header)).toBeTruthy()
})

it('Deny shows the decline warning', async () => {
  const user = await openFromOnboarding()

  await user.press(screen.getByText(consentCopy.denyLabel))

  expect(useUIStore.getState().dialog?.title).toBe(
    consentCopy.declineWarningTitle,
  )
})

it('goes back normally for a consented user, with no Deny', async () => {
  setConsent(true)
  await renderRouter(routes, { initialUrl: '/settings' })
  await act(async () => router.push('/data-agreement'))
  expect(screen.queryByText(consentCopy.denyLabel)).toBeNull()

  await pressBack()

  expect(screen.getByText('Settings')).toBeTruthy()
  expect(useUIStore.getState().dialog).toBeNull()
})
