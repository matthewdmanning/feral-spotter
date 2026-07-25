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
 *   PostHogProvider — analytics; a third-party data-collection library, so it
 *     only mounts once the user has accepted the consent disclosure AND the
 *     narrower analytics opt-in (see useConsentStore) — in addition to the
 *     existing IS_PRERELEASE gate at call sites. Before both are accepted,
 *     no PostHog SDK code runs at all — not just "events don't fire." The
 *     SDK does its own automatic capture (sessions, app lifecycle) as soon
 *     as it mounts, independent of fireAnalyticsEvent call sites, so gating
 *     only on general consent would let it run without the analytics opt-in.
 *   ErrorBoundary   — catches render errors at the root
 */

import { ErrorBoundary } from '@/src/components/atoms/ErrorBoundary'
import { CONSENT_VERSION, useConsentStore } from '@/src/hooks/useConsentStore'
import { IS_PRERELEASE } from '@/src/lib/analytics/analytics'
import { PostHogProvider } from 'posthog-react-native'
import { type ReactNode } from 'react'

const POSTHOG_KEY  = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? ''
const POSTHOG_HOST = 'https://app.posthog.com'

interface AppProvidersProps { children: ReactNode }

export function AppProviders({ children }: AppProvidersProps) {
  const hasAcceptedConsent = useConsentStore(
    (s) => s.accepted && s.acceptedVersion === CONSENT_VERSION,
  )
  const hasAcceptedAnalytics = useConsentStore((s) => s.analyticsAccepted)

  return (
    <ErrorBoundary>
      {IS_PRERELEASE && POSTHOG_KEY && hasAcceptedConsent && hasAcceptedAnalytics ? (
        <PostHogProvider apiKey={POSTHOG_KEY} options={{ host: POSTHOG_HOST }}>
          {children}
        </PostHogProvider>
      ) : (
        children
      )}
    </ErrorBoundary>
  )
}
