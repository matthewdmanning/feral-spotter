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
 *   AlertHost       — draws every app-raised dialog (see useUIStore's
 *     showAlert). Mounted once, above every screen, so the app owns its
 *     confirmations instead of the OS drawing them un-themed.
 *   ErrorBoundary   — catches render errors at the root; reports them via
 *     captureException (see AnalyticsBridge below) once consent + analytics
 *     opt-in allow it.
 */

import { AlertHost } from '@/src/components/organisms/AlertHost'
import { ErrorBoundary } from '@/src/components/atoms/ErrorBoundary'
import {
  getThemeMode,
  resolveThemeForAppearanceChange,
} from '@/src/config/unistyles'
import { CONSENT_VERSION, useConsentStore } from '@/src/hooks/useConsentStore'
import { useAuthStore } from '@/src/lib/auth/authStore'
import {
  IS_PRERELEASE,
  registerCapture,
  registerCaptureException,
} from '@/src/lib/analytics/analytics'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { usePathname } from 'expo-router'
import { PostHogProvider, usePostHog } from 'posthog-react-native'
import { useEffect, useRef, type ReactNode } from 'react'
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
 * (e.g. camera-open, which fires before the submission/reports screens that
 * used to own this registration ever mount) and crashes can originate
 * anywhere in the tree, so this must bind unconditionally on mount.
 */
function AnalyticsBridge() {
  const posthog = usePostHog()
  const user = useAuthStore((s) => s.user)
  const isAuthReady = useAuthStore((s) => s.isReady)
  const identifiedUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!posthog) return
    registerCapture(posthog.capture.bind(posthog))
    registerCaptureException(posthog.captureException.bind(posthog))
    // PostHog already supplies OS/app metadata. Add only the hardware fields
    // needed to compare camera performance without creating a custom device ID.
    posthog.register({
      device_model: Device.modelName,
      device_manufacturer: Device.manufacturer,
      is_physical_device: Device.isDevice,
    })
  }, [posthog])

  // Firebase's UID is the stable app identifier. This bridge mounts only after
  // analytics consent, so restoring an existing session identifies as soon as
  // collection is permitted; later captures and exception reports inherit it.
  useEffect(() => {
    if (!posthog || !isAuthReady) return

    if (!user) {
      if (identifiedUserId.current) posthog.reset()
      identifiedUserId.current = null
      return
    }

    if (identifiedUserId.current === user.uid) return
    if (identifiedUserId.current) posthog.reset()

    // UID is sufficient for correlation. Do not send email when crash and
    // performance analysis does not require directly identifying information.
    posthog.identify(user.uid)
    identifiedUserId.current = user.uid
  }, [isAuthReady, posthog, user])

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

export function AppProviders({ children }: AppProvidersProps) {
  const hasAcceptedConsent = useConsentStore(
    (s) => s.accepted && s.acceptedVersion === CONSENT_VERSION,
  )
  const hasAcceptedAnalytics = useConsentStore((s) => s.analyticsAccepted)

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {__DEV__ && <ScreenTransitionLogger />}
      <SystemThemeSync />
      {/* Outside ErrorBoundary's children so a caught render error still
          leaves the app able to raise a dialog. */}
      <AlertHost />
      <ErrorBoundary>
        {IS_PRERELEASE &&
        POSTHOG_KEY &&
        POSTHOG_HOST &&
        hasAcceptedConsent &&
        hasAcceptedAnalytics ? (
          <PostHogProvider
            apiKey={POSTHOG_KEY}
            options={{
              host: POSTHOG_HOST,
              // Capture unhandled JS exceptions globally. The root ErrorBoundary
              // reports render failures separately, so exclude console capture to
              // avoid React's console logging generating duplicate exceptions.
              // uncaughtExceptions/unhandledRejections are opt-in per-key, not
              // deep-merged with defaults — omitting either silently disables
              // it (confirmed against installed posthog-react-native source).
              errorTracking: {
                autocapture: {
                  uncaughtExceptions: true,
                  unhandledRejections: true,
                  console: [],
                },
              },
            }}
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
