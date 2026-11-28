import { render, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import React from 'react'
import { Text } from 'react-native'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { useAuth } from '@/src/features/auth/lib/useAuth'
import {
  CONSENT_VERSION,
  useConsentStore,
} from '@/src/shared/consent/useConsentStore'
import { useEntryGate } from '@/src/features/auth/hooks/useEntryGate'
import { nextConsentRoute } from '@/src/shared/consent/consentFlow'

jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  router: { replace: jest.fn(), navigate: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
}))

jest.mock('@/src/features/auth/lib/useAuth', () => ({ useAuth: jest.fn() }))
/** Stands in for the tab layout, which runs the gate and renders tabs only when it opens. */
function GateHarness() {
  return <Text>{useEntryGate() ? 'tabs' : 'no tabs'}</Text>
}

/**
 * Model of the app-wide auth/consent gate (useEntryGate, run by the (home-tabs) layout),
 * scoped only to this flow — not a project-wide pattern. Guards against #93
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
      },
    },
    unansweredStep: {},
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
    setMocks(false, false, false)
    const result = await render(<GateHarness />)
    rerender = result.rerender
  })

  const model = createTestModel(gateMachine)

  const testParams = {
    states: {
      initializing: () => {
        expect(router.replace).not.toHaveBeenCalled()
        expect(screen.getByText('no tabs')).toBeTruthy()
      },
      noConsentUnauthenticated: async () => {
        await waitFor(() =>
          expect(router.replace).toHaveBeenCalledWith('/intro-flow'),
        )
        jest.mocked(router.replace).mockClear()
      },
      noConsentAuthenticated: async () => {
        await waitFor(() =>
          expect(router.replace).toHaveBeenCalledWith('/intro-flow'),
        )
        jest.mocked(router.replace).mockClear()
      },
      consentedUnauthenticated: async () => {
        await waitFor(() =>
          expect(router.replace).toHaveBeenCalledWith('/sign-in'),
        )
        jest.mocked(router.replace).mockClear()
      },
      ready: () => {
        expect(router.replace).not.toHaveBeenCalled()
        expect(screen.getByText('tabs')).toBeTruthy()
      },
      unansweredStep: async () => {
        await waitFor(() =>
          expect(router.replace).toHaveBeenCalledWith(nextConsentRoute()),
        )
      },
    },
    events: {
      AUTH_READY_UNAUTHENTICATED_NO_CONSENT: async () => {
        setMocks(true, false, false)
        await rerender(<GateHarness />)
      },
      AUTH_READY_AUTHENTICATED_NO_CONSENT: async () => {
        setMocks(true, true, false)
        await rerender(<GateHarness />)
      },
      AUTH_READY_CONSENTED_UNAUTHENTICATED: async () => {
        setMocks(true, false, true)
        await rerender(<GateHarness />)
      },
      AUTH_READY_WITH_CONSENT: async () => {
        setMocks(true, true, true)
        await rerender(<GateHarness />)
      },
      AUTH_READY_STALE_CONSENT_VERSION: async () => {
        setMocks(true, true, 'stale-version')
        await rerender(<GateHarness />)
      },
      AUTH_READY_WITH_UNANSWERED_STEP: async () => {
        setMocks(true, true, 'unanswered')
        await rerender(<GateHarness />)
      },
      SIGN_IN: async () => {
        setMocks(true, true, true)
        await rerender(<GateHarness />)
      },
      SIGN_OUT: async () => {
        // Consent persists across sign-out — only auth drops.
        setMocks(true, false, true)
        await rerender(<GateHarness />)
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
