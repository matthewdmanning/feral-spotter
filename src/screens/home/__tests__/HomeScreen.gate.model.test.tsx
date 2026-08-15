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
  // spacing/radius/typography are real numbers (matching
  // src/config/unistyles.ts) so screens that do arithmetic on theme tokens
  // (e.g. HomeScreen's entrypoint-circle sizing) don't hit
  // "Cannot convert object to primitive value" from the generic anyProp stub.
  const knownTokens = {
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
    radius: { sm: 6, md: 8, lg: 12, xl: 16, xxl: 20, full: 9999 },
    typography: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, xxl: 24, xxxl: 30 },
  }
  const theme = new Proxy(knownTokens, {
    get: (t, k: string) => (k in t ? t[k as keyof typeof t] : anyProp()),
  })
  const withVariants = (obj: object) =>
    Object.assign(obj, { useVariants: jest.fn() })
  return {
    useUnistyles: () => ({ theme }),
    createStyleSheet: (fn: unknown) =>
      typeof fn === 'function' ? fn(theme) : fn,
    StyleSheet: {
      create: (fn: unknown) =>
        withVariants(typeof fn === 'function' ? fn(theme) : fn),
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
// This suite covers the auth/consent gate only — the photo-source gate has
// its own model test (HomeScreen.photoSourceGate.model.test.tsx).
jest.mock('@/src/hooks/usePhotoStore', () => ({
  usePhotoStore: (sel: (s: { source: null }) => unknown) =>
    sel({ source: null }),
}))
jest.mock('@/src/hooks/useLibraryPhotoPicker', () => ({
  useLibraryPhotoPicker: () => ({ pickFromLibrary: jest.fn() }),
}))
jest.mock('lucide-react-native', () => ({
  Camera: () => null,
  ImagePlus: () => null,
}))

/**
 * Model of HomeScreen's app-wide auth/consent gate (src/screens/home/index.tsx),
 * scoped only to this flow — not a project-wide pattern. Guards against #93
 * (registration->consent loop): the gate must never redirect while auth state
 * is indeterminate ("initializing" here, isReady=false in the real code).
 * Consent is checked first, ahead of auth (issue #163) — it's a device-level
 * grant that must survive sign-out, so a consented-but-signed-out user lands
 * on /sign-in, never back on /intro-flow.
 *
 * Transitions are restricted to changes in `isAuthenticated` — the gate
 * effect's only real reactive dependency (`hasAcceptedConsent()` is a plain
 * snapshot read, not subscribed). This also matches reality: in the actual
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
      },
    },
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
      noConsentUnauthenticated: async () => {
        await waitFor(() =>
          expect(router.replace).toHaveBeenCalledWith('/intro-flow'),
        )
        ;(router.replace as jest.Mock).mockClear()
      },
      noConsentAuthenticated: async () => {
        await waitFor(() =>
          expect(router.replace).toHaveBeenCalledWith('/intro-flow'),
        )
        ;(router.replace as jest.Mock).mockClear()
      },
      consentedUnauthenticated: async () => {
        await waitFor(() =>
          expect(router.replace).toHaveBeenCalledWith('/sign-in'),
        )
        ;(router.replace as jest.Mock).mockClear()
      },
      ready: () => {
        expect(router.replace).not.toHaveBeenCalled()
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
      name: 'consented, signed out, then signs back in → home',
      events: [
        { type: 'AUTH_READY_CONSENTED_UNAUTHENTICATED' },
        { type: 'SIGN_IN' },
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
