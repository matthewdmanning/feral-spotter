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
 *   GestureHandlerRootView — required at the app root for
 *     react-native-gesture-handler-backed gestures (react-navigation
 *     native-stack swipe-back included) to work at all.
 *   PostHogProvider — analytics; a third-party data-collection library, so it
 *     only mounts once the user has accepted the consent disclosure AND the
 *     narrower analytics opt-in (see useConsentStore) — in addition to the
 *     existing IS_PRERELEASE gate at call sites. Before both are accepted,
 *     no PostHog SDK code runs at all — not just "events don't fire." The
 *     SDK does its own automatic capture (sessions, app lifecycle) as soon
 *     as it mounts, independent of fireAnalyticsEvent call sites, so gating
 *     only on general consent would let it run without the analytics opt-in.
 *   ErrorBoundary   — catches render errors at the root; reports them via
 *     captureException (see AnalyticsBridge below) once consent + analytics
 *     opt-in allow it.
 */

import { ErrorBoundary } from '@/src/components/atoms/ErrorBoundary'
import { CONSENT_VERSION, useConsentStore } from '@/src/hooks/useConsentStore'
import {
  IS_PRERELEASE,
  registerCapture,
  registerCaptureException,
} from '@/src/lib/analytics/analytics'
import { usePathname } from 'expo-router'
import { PostHogProvider, usePostHog } from 'posthog-react-native'
import { useEffect, type ReactNode } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? ''
const POSTHOG_HOST = 'https://app.posthog.com'

// #201: missing key otherwise silently voids every analytics check with no
// signal — this was mistaken for a real bug in a previous test-drive session.
if (__DEV__ && IS_PRERELEASE && !POSTHOG_KEY) {
  console.warn('[analytics] disabled — EXPO_PUBLIC_POSTHOG_KEY not set')
}

interface AppProvidersProps {
  children: ReactNode
}

/**
 * Registers both capturers app-wide as soon as PostHog mounts, rather than
 * relying on a specific screen having been visited first. Both funnel events
 * (e.g. camera-open, which fires before the submission/reports screens that
 * used to own this registration ever mount) and crashes can originate
 * anywhere in the tree, so this must bind unconditionally on mount.
 */
function AnalyticsBridge() {
  const posthog = usePostHog()
  useEffect(() => {
    if (!posthog) return
    registerCapture(posthog.capture.bind(posthog))
    registerCaptureException(posthog.captureException.bind(posthog))
  }, [posthog])
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

export function AppProviders({ children }: AppProvidersProps) {
  const hasAcceptedConsent = useConsentStore(
    (s) => s.accepted && s.acceptedVersion === CONSENT_VERSION,
  )
  const hasAcceptedAnalytics = useConsentStore((s) => s.analyticsAccepted)

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {__DEV__ && <ScreenTransitionLogger />}
      <ErrorBoundary>
        {IS_PRERELEASE &&
        POSTHOG_KEY &&
        hasAcceptedConsent &&
        hasAcceptedAnalytics ? (
          <PostHogProvider
            apiKey={POSTHOG_KEY}
            options={{ host: POSTHOG_HOST }}
            debug={__DEV__}
          >
            <AnalyticsBridge />
            {children}
          </PostHogProvider>
        ) : (
          children
        )}
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}
