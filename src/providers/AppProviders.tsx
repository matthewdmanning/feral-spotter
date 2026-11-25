/**
 * providers/AppProviders.tsx
 * Single source of truth for all app-wide context providers.
 * Imported by app/_layout.tsx only — nowhere else.
 *
 * SafeAreaProvider removed: Unistyles 3.0 reads insets natively via
 * SafeAreaInsets (iOS) / WindowInsetsCompat (Android) and exposes them
 * as `rt.insets` directly inside StyleSheet.create — no React context
 * or hook required. See: Edge to edge layout guide.
 *
 * Providers:
 *   QueryClientProvider — one TanStack Query client for the app's server
 *     data (organizations), so hooks read it with useQueryClient and tests
 *     can give each test its own.
 *   GestureHandlerRootView — required at the app root for
 *     react-native-gesture-handler-backed gestures (react-navigation
 *     native-stack swipe-back included) to work at all.
 *   PostHogProvider — analytics; a third-party data-collection library, so it
 *     only mounts once the user has accepted the consent disclosure AND the
 *     narrower analytics opt-in (see useConsentStore) — in addition to the
 *     existing IS_RELEASE_CANDIDATE gate at call sites. Before both are accepted,
 *     no PostHog SDK client exists. The SDK does its own automatic capture
 *     (sessions, app lifecycle, uncaught exceptions) independent of
 *     captureEvent call sites, so on revocation the one client
 *     (shared/analytics/posthogClient.ts) is opted out, not just unmounted.
 *   AlertHost       — draws every app-raised dialog (see useUIStore's
 *     showAlert). Mounted once, above every screen, so the app owns its
 *     confirmations instead of the OS drawing them un-themed.
 *   ErrorBoundary   — catches render errors at the root; reports them via
 *     captureException (see AnalyticsBridge below) once consent + analytics
 *     opt-in allow it.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@/src/shared/lib/queryClient'
import { OrganizationsRuntime } from '@/src/features/organizations/components/OrganizationsRuntime'
import { AccountConsentRuntime } from '@/src/features/auth/components/AccountConsentRuntime'
import { AccountDeletionRuntime } from '@/src/workflows/account-deletion/components/AccountDeletionRuntime'
import { usePendingDeletionStore } from '@/src/shared/lib/pendingDeletion'
import { AlertHost } from '@/src/shared/ui/organisms/AlertHost'
import { ErrorBoundary } from '@/src/shared/ui/atoms/ErrorBoundary'
import {
  getThemeMode,
  resolveThemeForAppearanceChange,
} from '@/src/shared/config/unistyles'
import {
  CONSENT_VERSION,
  analyticsAcceptedFor,
  useConsentStore,
} from '@/src/shared/consent/useConsentStore'
import { authProvider } from '@/src/features/auth/lib'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import {
  IS_RELEASE_CANDIDATE,
  analyticsAllowed,
  registerCapture,
  registerCaptureException,
} from '@/src/shared/analytics/analytics'
import {
  posthogFlagClient,
  registerFlagClient,
} from '@/src/shared/analytics/featureFlags'
import {
  closePostHogClient,
  forgetSignedOutIdentity,
  openPostHogClient,
  registerDeviceProperties,
  screenNameFromSegments,
  syncPostHogIdentity,
} from '@/src/shared/analytics/posthogClient'
import Constants from 'expo-constants'
import { usePathname, useSegments } from 'expo-router'
import { PostHogProvider, usePostHog, type PostHog } from 'posthog-react-native'
import { useEffect, useState, type ReactNode } from 'react'
import { Appearance } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { UnistylesRuntime } from 'react-native-unistyles'

// Expo embeds values from app.config.js extras into native builds.
const POSTHOG_KEY = Constants.expoConfig?.extra?.posthogProjectToken as
  string | undefined
const POSTHOG_HOST = Constants.expoConfig?.extra?.posthogHost as
  string | undefined

if (__DEV__ && !POSTHOG_KEY) {
  console.error(
    'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured',
  )
}

if (__DEV__ && !POSTHOG_HOST) {
  console.error(
    'POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_HOST is configured',
  )
}

interface AppProvidersProps {
  children: ReactNode
}

/**
 * Registers both capturers app-wide as soon as PostHog mounts, rather than
 * relying on a specific screen having been visited first. Both funnel events
 * (e.g. camera-open) and crashes can originate anywhere in the tree, so this
 * binds unconditionally on mount; calls made before it binds are replayed
 * (analytics.ts). Unbinds on unmount so nothing reaches a revoked client.
 */
function AnalyticsBridge({ uid }: { uid: string }) {
  const posthog = usePostHog()
  const segments = useSegments()
  const screenName = screenNameFromSegments(segments)

  const [readyUid, setReadyUid] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    void posthog.ready().then(() => {
      if (!current || !analyticsAllowed()) return
      if (useConsentStore.getState().activeUid !== uid) return
      registerDeviceProperties(posthog)
      syncPostHogIdentity(posthog, uid)
      registerCapture(posthog.capture.bind(posthog))
      registerCaptureException(posthog.captureException.bind(posthog))
      registerFlagClient(posthogFlagClient(posthog))
      setReadyUid(uid)
    })
    return () => {
      current = false
      registerCapture(null)
      registerCaptureException(null)
      registerFlagClient(null)
    }
  }, [posthog, uid])

  useEffect(() => {
    if (readyUid === uid && analyticsAllowed()) void posthog.screen(screenName)
  }, [posthog, readyUid, screenName, uid])

  return null
}

// #201: no in-app screen-transition trail existed — a test-drive session's
// "user journey" could only be reconstructed from the tester's own
// narration. This is local-only console output (no network, no PII, dev
// builds only), so it's mounted unconditionally rather than gated behind
// analytics consent like AnalyticsBridge above.
function ScreenTransitionLogger() {
  const pathname = usePathname()
  useEffect(() => {
    if (__DEV__) console.log(`[nav] ${pathname}`)
  }, [pathname])
  return null
}

// #338: Unistyles' own adaptiveThemes setting does not track a live OS
// appearance change in this app (confirmed on-device, not just theoretical —
// see docs/implementations for the finding). Appearance.addChangeListener
// does, in every environment, so 'system' mode is driven from here instead —
// mounted once at the root, same lifetime as AlertHost above it.
function SystemThemeSync() {
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const next = resolveThemeForAppearanceChange(colorScheme, getThemeMode())
      if (next) UnistylesRuntime.setTheme(next)
    })
    return () => subscription.remove()
  }, [])
  return null
}

const POSTHOG_HOST_STYLE = {
  position: 'absolute',
  width: 0,
  height: 0,
} as const

const POSTHOG_AUTOCAPTURE = {
  captureScreens: false,
  captureTouches: false,
} as const

export function AppProviders({ children }: AppProvidersProps) {
  const hasAcceptedConsent = useConsentStore(
    (s) => s.accepted && s.acceptedVersion === CONSENT_VERSION,
  )
  const uid = useAuthStore((s) => (s.isReady ? (s.user?.uid ?? null) : null))
  const signedOut = useAuthStore((s) => s.isReady && s.user === null)
  const hasAcceptedAnalytics = useConsentStore((s) =>
    analyticsAcceptedFor(s, uid),
  )
  const deletionPending = usePendingDeletionStore((s) => s.pending !== null)
  const [queryClient] = useState(createQueryClient)
  const [posthog, setPosthog] = useState<PostHog | null>(null)
  const analyticsOn =
    IS_RELEASE_CANDIDATE &&
    uid !== null &&
    !deletionPending &&
    hasAcceptedConsent &&
    hasAcceptedAnalytics

  useEffect(() => {
    if (!analyticsOn || !POSTHOG_KEY || !POSTHOG_HOST) return
    let current = true
    const sdk = openPostHogClient(
      POSTHOG_KEY,
      POSTHOG_HOST,
      undefined,
      (sdk) =>
        analyticsAllowed() &&
        sdk.getDistinctId() === uid &&
        authProvider.getCurrentUser()?.uid === uid,
    )
    void sdk.ready().then(() => {
      if (current) setPosthog(sdk)
    })
    return () => {
      current = false
      closePostHogClient()
    }
  }, [analyticsOn, uid])

  // Only a reported sign-out: before auth is ready, "no user" is a guess.
  useEffect(() => {
    if (signedOut) forgetSignedOutIdentity()
  }, [signedOut])

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {__DEV__ && <ScreenTransitionLogger />}
        <SystemThemeSync />
        <OrganizationsRuntime />
        <AccountConsentRuntime />
        <AccountDeletionRuntime />
        {/* Outside ErrorBoundary's children so a caught render error still
          leaves the app able to raise a dialog. */}
        <AlertHost />
        {/* A sibling of the app, not its parent: wrapping `children` only
          while consented gave them a different parent each time consent
          flipped (and on every cold start, as consent hydrates), and React
          remounted the whole app. Only AnalyticsBridge reads PostHog. */}
        {analyticsOn && uid !== null && posthog && (
          <PostHogProvider
            // Its wrapper View defaults to flex: 1; as a sibling it must take
            // no space from the app.
            style={POSTHOG_HOST_STYLE}
            client={posthog}
            // AnalyticsBridge tracks screens; touch autocapture stays off.
            autocapture={POSTHOG_AUTOCAPTURE}
            debug={__DEV__}
          >
            <AnalyticsBridge key={uid} uid={uid} />
          </PostHogProvider>
        )}
        <ErrorBoundary>{children}</ErrorBoundary>
      </GestureHandlerRootView>
    </QueryClientProvider>
  )
}
