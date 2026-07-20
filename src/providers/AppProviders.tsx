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
 *   PostHogProvider — analytics (IS_PRERELEASE guarded at call sites)
 *   ErrorBoundary   — catches render errors at the root
 */

import { ErrorBoundary } from '@/src/components/atoms/ErrorBoundary'
import { IS_PRERELEASE } from '@/src/lib/analytics/analytics'
import { PostHogProvider } from 'posthog-react-native'
import { type ReactNode } from 'react'

const POSTHOG_KEY  = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? ''
const POSTHOG_HOST = 'https://app.posthog.com'

interface AppProvidersProps { children: ReactNode }

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ErrorBoundary>
      {IS_PRERELEASE && POSTHOG_KEY ? (
        <PostHogProvider apiKey={POSTHOG_KEY} options={{ host: POSTHOG_HOST }}>
          {children}
        </PostHogProvider>
      ) : (
        children
      )}
    </ErrorBoundary>
  )
}
