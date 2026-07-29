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
    createStyleSheet: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn),
    StyleSheet: { create: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn) },
  }
})

jest.mock('@/src/lib/auth/useAuth', () => ({ useAuth: jest.fn() }))
jest.mock('@/src/hooks/useConsentStore', () => ({ hasAcceptedConsent: jest.fn() }))
jest.mock('@/src/lib/cache/submissionCache', () => ({
  getAllSubmissionCaches: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/src/components/molecules/BottomButtonColumn', () => ({ BottomButtonColumn: () => null }))
jest.mock('lucide-react-native', () => ({ Camera: () => null, Settings: () => null }))

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
      on: { SIGN_IN: 'authenticatedNoConsent' },
    },
    authenticatedNoConsent: {
      on: { AGREE_CONSENT: 'ready' },
    },
    ready: {},
  },
})

describe('HomeScreen gate — model-based test', () => {
  let rerender: (ui: React.ReactElement) => void

  const setMocks = (isReady: boolean, isAuthenticated: boolean, consent: boolean) => {
    ;(useAuth as jest.Mock).mockReturnValue({
      isReady, isAuthenticated, signIn: jest.fn(), signOut: jest.fn(),
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
        await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/intro-flow'))
        ;(router.replace as jest.Mock).mockClear()
      },
      authenticatedNoConsent: async () => {
        await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/consent'))
        ;(router.replace as jest.Mock).mockClear()
      },
      ready: () => {
        expect(router.replace).not.toHaveBeenCalled()
      },
    },
    events: {
      AUTH_READY_UNAUTHENTICATED: () => { setMocks(true, false, false); rerender(<HomeScreen />) },
      AUTH_READY_NO_CONSENT: () => { setMocks(true, true, false); rerender(<HomeScreen />) },
      AUTH_READY_WITH_CONSENT: () => { setMocks(true, true, true); rerender(<HomeScreen />) },
      SIGN_IN: () => { setMocks(true, true, false); rerender(<HomeScreen />) },
      AGREE_CONSENT: () => { setMocks(true, true, true); rerender(<HomeScreen />) },
    },
  }

  model.getShortestPaths().forEach((path) => {
    it(path.description, async () => {
      await path.test(testParams)
    })
  })
})
