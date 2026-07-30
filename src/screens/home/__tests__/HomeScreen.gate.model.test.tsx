import { render, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'
import React from 'react'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { useAuth } from '@/src/lib/auth/useAuth'
import { hasAcceptedConsent } from '@/src/hooks/useConsentStore'
import HomeScreen from '../index'

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), navigate: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
}))

jest.mock('react-native-unistyles', () => {
  const anyProp = (): unknown => new Proxy({}, { get: (_t, _k) => anyProp() })
  const theme = new Proxy({}, { get: (_t, _k) => anyProp() })
  return {
    useUnistyles: () => ({ theme }),
    createStyleSheet: (fn: unknown) =>
      typeof fn === 'function' ? fn(theme) : fn,
    StyleSheet: {
      create: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn),
    },
  }
})

jest.mock('@/src/lib/auth/useAuth', () => ({ useAuth: jest.fn() }))
jest.mock('@/src/hooks/useConsentStore', () => ({
  hasAcceptedConsent: jest.fn(),
}))
jest.mock('@/src/lib/cache/submissionCache', () => ({
  getAllSubmissionCaches: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/src/components/molecules/BottomButtonColumn', () => ({
  BottomButtonColumn: () => null,
}))
jest.mock('lucide-react-native', () => ({
  Camera: () => null,
  Settings: () => null,
}))

/**
 * Model of HomeScreen's app-wide auth/consent gate (src/screens/home/index.tsx),
 * scoped only to this flow — not a project-wide pattern. Guards against #93
 * (registration->consent loop): the gate must never redirect while auth state
 * is indeterminate ("initializing" here, isReady=false in the real code),
 * and must land on the right screen for every authenticated/consent
 * combination. Model-based testing walks every reachable state via
 * @xstate/graph instead of only the cases someone thought to hand-write.
 */
const gateMachine = createMachine({
  id: 'homeGate',
  initial: 'initializing',
  states: {
    initializing: {
      on: {
        AUTH_READY_UNAUTHENTICATED: 'unauthenticated',
        AUTH_READY_NO_CONSENT: 'authenticatedNoConsent',
        AUTH_READY_WITH_CONSENT: 'ready',
      },
    },
    unauthenticated: {
      on: {
        // New device: sign-in leaves device consent still outstanding.
        SIGN_IN: 'authenticatedNoConsent',
        // Returning user: device consent persists across sign-out, so
        // re-authenticating lands straight on home.
        SIGN_IN_RETURNING: 'ready',
      },
    },
    authenticatedNoConsent: {
      on: {
        AGREE_CONSENT: 'ready',
        // Bail out of the consent screen by signing out.
        SIGN_OUT: 'unauthenticated',
      },
    },
    ready: {
      on: { SIGN_OUT: 'unauthenticated' },
    },
  },
})

describe('HomeScreen gate — model-based test', () => {
  let rerender: (ui: React.ReactElement) => void

  const setMocks = (
    isReady: boolean,
    isAuthenticated: boolean,
    consent: boolean,
  ) => {
    ;(useAuth as jest.Mock).mockReturnValue({
      isReady,
      isAuthenticated,
      signIn: jest.fn(),
      signOut: jest.fn(),
    })
    ;(hasAcceptedConsent as jest.Mock).mockReturnValue(consent)
  }

  beforeEach(() => {
    jest.clearAllMocks()
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
      unauthenticated: async () => {
        await waitFor(() =>
          expect(router.replace).toHaveBeenCalledWith('/intro-flow'),
        )
        ;(router.replace as jest.Mock).mockClear()
      },
      authenticatedNoConsent: async () => {
        await waitFor(() =>
          expect(router.replace).toHaveBeenCalledWith('/consent'),
        )
        ;(router.replace as jest.Mock).mockClear()
      },
      ready: () => {
        expect(router.replace).not.toHaveBeenCalled()
      },
    },
    events: {
      AUTH_READY_UNAUTHENTICATED: () => {
        setMocks(true, false, false)
        rerender(<HomeScreen />)
      },
      AUTH_READY_NO_CONSENT: () => {
        setMocks(true, true, false)
        rerender(<HomeScreen />)
      },
      AUTH_READY_WITH_CONSENT: () => {
        setMocks(true, true, true)
        rerender(<HomeScreen />)
      },
      SIGN_IN: () => {
        setMocks(true, true, false)
        rerender(<HomeScreen />)
      },
      // Returning user on an already-consented device: authenticated and
      // consent already on file.
      SIGN_IN_RETURNING: () => {
        setMocks(true, true, true)
        rerender(<HomeScreen />)
      },
      AGREE_CONSENT: () => {
        setMocks(true, true, true)
        rerender(<HomeScreen />)
      },
      // Signed-in user signs out: auth drops, gate must send them back to
      // the intro flow.
      SIGN_OUT: () => {
        setMocks(true, false, false)
        rerender(<HomeScreen />)
      },
    },
  }

  // UX journeys, not exhaustive coverage: each is a sequence of real user
  // actions, asserting the redirect observed at every step. getPathsFromEvents
  // (vs getShortestPaths) lets us name the journey a user actually takes.
  const journeys = [
    {
      name: 'first launch: unauthenticated → sign in → agree consent → home',
      events: [
        { type: 'AUTH_READY_UNAUTHENTICATED' },
        { type: 'SIGN_IN' },
        { type: 'AGREE_CONSENT' },
      ],
    },
    {
      name: 'returning user with consent lands on home directly',
      events: [{ type: 'AUTH_READY_WITH_CONSENT' }],
    },
    {
      name: 'signed-in user signs out → back to intro flow',
      events: [{ type: 'AUTH_READY_WITH_CONSENT' }, { type: 'SIGN_OUT' }],
    },
    {
      name: 'bail from consent screen by signing out → intro flow',
      events: [{ type: 'AUTH_READY_NO_CONSENT' }, { type: 'SIGN_OUT' }],
    },
    {
      name: 'returning user re-signs in on consented device → home',
      events: [
        { type: 'AUTH_READY_UNAUTHENTICATED' },
        { type: 'SIGN_IN_RETURNING' },
      ],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })
})
