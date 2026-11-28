import AsyncStorage from '@react-native-async-storage/async-storage'
import { render, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import React from 'react'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { useAuth } from '@/src/features/auth/lib/useAuth'
import {
  CONSENT_VERSION,
  useConsentStore,
} from '@/src/shared/consent/useConsentStore'
import { nextConsentRoute } from '@/src/shared/consent/consentFlow'
import HomeTabsLayout from '@/src/app/(home-tabs)/_layout'

jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  router: { replace: jest.fn(), navigate: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
}))

jest.mock('@/src/features/auth/lib/useAuth', () => ({ useAuth: jest.fn() }))

// The real layout runs the gate; this spy stands at the NativeTabs boundary,
// so a mount is exactly what would send PRELOAD actions (#495).
const mockTabsMount = jest.fn()
jest.mock('expo-router/native-tabs', () => {
  const { Text: MockText } = jest.requireActual('react-native')
  const Empty = () => null
  const Trigger = Object.assign(Empty, { Label: Empty, Icon: Empty })
  return {
    NativeTabs: Object.assign(
      function MockNativeTabs() {
        mockTabsMount()
        return <MockText>tabs</MockText>
      },
      { Trigger },
    ),
  }
})

const tabsShown = () => screen.queryByText('tabs') !== null

/**
 * Model of the app-wide auth/consent gate (useEntryGate), rendered through the
 * real (home-tabs) layout, scoped only to this flow — not a project-wide
 * pattern. Tabs must never mount before a redirect away from them (#495):
 * that is asserted at the NativeTabs boundary, so dropping the layout's own
 * check fails this suite. Guards against #93
 * (registration->consent loop): the gate must never redirect while auth state
 * is indeterminate ("initializing" here, isReady=false in the real code).
 * Consent is checked first, ahead of auth (issue #163) — it's a device-level
 * grant that must survive sign-out, so a consented-but-signed-out user lands
 * on /sign-in, never back on /intro-flow.
 *
 * Transitions are restricted to changes in `isAuthenticated` — the gate
 * effect's only real reactive dependency (consent is read as a snapshot
 * from the real consent store, not subscribed). This also matches reality: in the actual
 * app the tab layout is never mounted between /consent and /sign-in — each screen
 * navigates explicitly — so a live layout instance never witnesses consent
 * changing underneath it. The "no consent" states are dead ends for the
 * same reason: once redirected away, that layout instance's job is done;
 * a later visit is a fresh mount, modeled as a new entry from `initializing`.
 * Model-based testing walks every reachable state via @xstate/graph instead
 * of only the cases someone thought to hand-write.
 *
 * Optional consent steps (email, analytics) never hold the tabs: the step is
 * pushed over the open tabs. A failed read of saved consent settles on the
 * defaults (not accepted) instead of a permanent blank screen.
 */
const gateMachine = createMachine({
  id: 'homeGate',
  initial: 'initializing',
  states: {
    initializing: {
      on: {
        AUTH_READY_UNAUTHENTICATED_NO_CONSENT: 'noConsentUnauthenticated',
        // Edge case: an existing account (e.g. re-installed app, local
        // consent store cleared) still has no device consent on file.
        AUTH_READY_AUTHENTICATED_NO_CONSENT: 'noConsentAuthenticated',
        // Consent already on file for this device, no active session.
        AUTH_READY_CONSENTED_UNAUTHENTICATED: 'consentedUnauthenticated',
        AUTH_READY_WITH_CONSENT: 'ready',
        // Accepted an older disclosure: CONSENT_VERSION was bumped since.
        AUTH_READY_STALE_CONSENT_VERSION: 'noConsentAuthenticated',
        // The app was killed on email opt-in: the chain resumes there.
        AUTH_READY_WITH_UNANSWERED_STEP: 'unansweredStep',
        // Saved consent could not be read (storage error, corrupt JSON).
        CONSENT_READ_FAILED: 'consentReadFailed',
      },
    },
    unansweredStep: {},
    consentReadFailed: {},
    noConsentUnauthenticated: {},
    noConsentAuthenticated: {},
    consentedUnauthenticated: {
      on: {
        SIGN_IN: 'ready',
      },
    },
    ready: {
      on: {
        // Consent is device-level, not session-level — it survives sign-out.
        SIGN_OUT: 'consentedUnauthenticated',
      },
    },
  },
})

describe('useEntryGate — model-based test', () => {
  let rerender: (ui: React.ReactElement) => void

  type Consent = boolean | 'stale-version' | 'unanswered'
  const setMocks = (
    isReady: boolean,
    isAuthenticated: boolean,
    consent: Consent,
  ) => {
    jest.mocked(useAuth).mockReturnValue({
      isReady,
      isAuthenticated,
      user: isAuthenticated ? { uid: 'account', email: null } : null,
      signIn: jest.fn(),
      signOut: jest.fn(),
    } as unknown as ReturnType<typeof useAuth>)
    useConsentStore.setState({
      accepted: consent !== false,
      acceptedVersion:
        consent === false
          ? null
          : consent === 'stale-version'
            ? CONSENT_VERSION - 1
            : CONSENT_VERSION,
      emailOptIn: consent === 'unanswered' ? null : false,
      analyticsAccepted: consent === 'unanswered' ? null : false,
    })
  }

  beforeEach(async () => {
    await useConsentStore.persist.rehydrate()
    setMocks(false, false, false)
    const result = await render(<HomeTabsLayout />)
    rerender = result.rerender
  })

  const model = createTestModel(gateMachine)

  const testParams = {
    states: {
      initializing: () => {
        expect(router.replace).not.toHaveBeenCalled()
        expect(mockTabsMount).not.toHaveBeenCalled()
      },
      noConsentUnauthenticated: async () => {
        await waitFor(() =>
          expect(router.replace).toHaveBeenCalledWith('/intro-flow'),
        )
        expect(mockTabsMount).not.toHaveBeenCalled()
        jest.mocked(router.replace).mockClear()
      },
      noConsentAuthenticated: async () => {
        await waitFor(() =>
          expect(router.replace).toHaveBeenCalledWith('/intro-flow'),
        )
        expect(mockTabsMount).not.toHaveBeenCalled()
        jest.mocked(router.replace).mockClear()
      },
      consentedUnauthenticated: async () => {
        await waitFor(() =>
          expect(router.replace).toHaveBeenCalledWith('/sign-in'),
        )
        expect(tabsShown()).toBe(false)
        jest.mocked(router.replace).mockClear()
      },
      ready: () => {
        expect(router.replace).not.toHaveBeenCalled()
        expect(tabsShown()).toBe(true)
      },
      unansweredStep: async () => {
        // Tabs open at once; the step goes over them, not in their place.
        expect(tabsShown()).toBe(true)
        await waitFor(() =>
          expect(router.push).toHaveBeenCalledWith(nextConsentRoute()),
        )
        expect(router.replace).not.toHaveBeenCalled()
      },
      consentReadFailed: async () => {
        await waitFor(() =>
          expect(router.replace).toHaveBeenCalledWith('/intro-flow'),
        )
        expect(mockTabsMount).not.toHaveBeenCalled()
      },
    },
    events: {
      AUTH_READY_UNAUTHENTICATED_NO_CONSENT: async () => {
        setMocks(true, false, false)
        await rerender(<HomeTabsLayout />)
      },
      AUTH_READY_AUTHENTICATED_NO_CONSENT: async () => {
        setMocks(true, true, false)
        await rerender(<HomeTabsLayout />)
      },
      AUTH_READY_CONSENTED_UNAUTHENTICATED: async () => {
        setMocks(true, false, true)
        await rerender(<HomeTabsLayout />)
      },
      AUTH_READY_WITH_CONSENT: async () => {
        setMocks(true, true, true)
        await rerender(<HomeTabsLayout />)
      },
      AUTH_READY_STALE_CONSENT_VERSION: async () => {
        setMocks(true, true, 'stale-version')
        await rerender(<HomeTabsLayout />)
      },
      AUTH_READY_WITH_UNANSWERED_STEP: async () => {
        setMocks(true, true, 'unanswered')
        await rerender(<HomeTabsLayout />)
      },
      CONSENT_READ_FAILED: async () => {
        setMocks(true, true, false)
        jest
          .spyOn(AsyncStorage, 'getItem')
          .mockRejectedValueOnce(new Error('storage unavailable'))
        await useConsentStore.persist.rehydrate()
        await rerender(<HomeTabsLayout />)
      },
      SIGN_IN: async () => {
        setMocks(true, true, true)
        await rerender(<HomeTabsLayout />)
      },
      SIGN_OUT: async () => {
        // Consent persists across sign-out — only auth drops.
        setMocks(true, false, true)
        await rerender(<HomeTabsLayout />)
      },
    },
  }

  // UX journeys, not exhaustive coverage: each is a sequence of real user
  // actions, asserting the redirect observed at every step. getPathsFromEvents
  // (vs getShortestPaths) lets us name the journey a user actually takes.
  const journeys = [
    {
      name: 'first launch: unauthenticated, no consent → redirected to intro-flow',
      events: [{ type: 'AUTH_READY_UNAUTHENTICATED_NO_CONSENT' }],
    },
    {
      name: 'signed-in consented user signs out → sign-in, not intro-flow',
      events: [{ type: 'AUTH_READY_WITH_CONSENT' }, { type: 'SIGN_OUT' }],
    },
    {
      name: 'consent given to an older disclosure version → intro-flow again',
      events: [{ type: 'AUTH_READY_STALE_CONSENT_VERSION' }],
    },
    {
      name: 'signed in with an unanswered consent step → that step',
      events: [{ type: 'AUTH_READY_WITH_UNANSWERED_STEP' }],
    },
    {
      name: 'saved consent cannot be read → intro-flow, not a blank screen',
      events: [{ type: 'CONSENT_READ_FAILED' }],
    },
    {
      name: 'consented, signed out, then signs back in → home',
      events: [
        { type: 'AUTH_READY_CONSENTED_UNAUTHENTICATED' },
        { type: 'SIGN_IN' },
      ],
    },
  ]

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })
})
