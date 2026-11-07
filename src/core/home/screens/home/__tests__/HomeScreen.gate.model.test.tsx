import { render, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import React from 'react'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { useAuth } from '@/src/features/auth/lib/useAuth'
import {
  CONSENT_VERSION,
  useConsentStore,
} from '@/src/shared/consent/useConsentStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import HomeScreen from '@/src/core/home/screens/home/index'

jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  router: { replace: jest.fn(), navigate: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
}))

jest.mock('@/src/features/auth/lib/useAuth', () => ({ useAuth: jest.fn() }))
jest.mock('@/src/shared/lib/submissionCache', () => ({
  getAllSubmissionCaches: jest.fn().mockResolvedValue([]),
  getCurrentCacheId: jest.fn().mockResolvedValue(null),
}))
jest.mock('@/src/shared/ui/molecules/BottomButtonColumn', () => ({
  BottomButtonColumn: () => null,
}))
jest.mock('@/src/features/library-picker/hooks/useLibraryPhotoPicker', () => ({
  useLibraryPhotoPicker: () => ({ pickFromLibrary: jest.fn() }),
}))
/**
 * Model of HomeScreen's app-wide auth/consent gate (src/core/home/screens/home/index.tsx),
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
 * app Home is never mounted between /consent and /sign-in — each screen
 * navigates explicitly — so a live Home instance never witnesses consent
 * changing underneath it. The "no consent" states are dead ends for the
 * same reason: once redirected away, that Home instance's job is done;
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

describe('HomeScreen gate — model-based test', () => {
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

  beforeEach(() => {
    // This suite covers the auth/consent gate only — the photo-source gate
    // has its own model test (HomeScreen.photoSourceGate.model.test.tsx).
    usePhotoStore.setState(usePhotoStore.getInitialState(), true)
    setMocks(false, false, false)
    const result = render(<HomeScreen />)
    rerender = result.rerender
  })

  const model = createTestModel(gateMachine)

  const testParams = {
    states: {
      initializing: () => {
        expect(router.replace).not.toHaveBeenCalled()
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
      },
      unansweredStep: async () => {
        await waitFor(() =>
          expect(router.replace).toHaveBeenCalledWith('/email-opt-in'),
        )
      },
    },
    events: {
      AUTH_READY_UNAUTHENTICATED_NO_CONSENT: () => {
        setMocks(true, false, false)
        rerender(<HomeScreen />)
      },
      AUTH_READY_AUTHENTICATED_NO_CONSENT: () => {
        setMocks(true, true, false)
        rerender(<HomeScreen />)
      },
      AUTH_READY_CONSENTED_UNAUTHENTICATED: () => {
        setMocks(true, false, true)
        rerender(<HomeScreen />)
      },
      AUTH_READY_WITH_CONSENT: () => {
        setMocks(true, true, true)
        rerender(<HomeScreen />)
      },
      AUTH_READY_STALE_CONSENT_VERSION: () => {
        setMocks(true, true, 'stale-version')
        rerender(<HomeScreen />)
      },
      AUTH_READY_WITH_UNANSWERED_STEP: () => {
        setMocks(true, true, 'unanswered')
        rerender(<HomeScreen />)
      },
      SIGN_IN: () => {
        setMocks(true, true, true)
        rerender(<HomeScreen />)
      },
      SIGN_OUT: () => {
        // Consent persists across sign-out — only auth drops.
        setMocks(true, false, true)
        rerender(<HomeScreen />)
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
      name: 'existing account, device consent missing → redirected to intro-flow',
      events: [{ type: 'AUTH_READY_AUTHENTICATED_NO_CONSENT' }],
    },
    {
      name: 'consent already on device but signed out → straight to sign-in, skips intro-flow',
      events: [{ type: 'AUTH_READY_CONSENTED_UNAUTHENTICATED' }],
    },
    {
      name: 'returning user with consent lands on home directly',
      events: [{ type: 'AUTH_READY_WITH_CONSENT' }],
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
