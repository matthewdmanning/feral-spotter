import { authProvider } from '@/src/lib/auth'
import { useAuthStore } from '@/src/lib/auth/authStore'
import type { FederatedProviderId } from '@/src/lib/auth/authProviders'
import { useCallback } from 'react'

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const isReady = useAuthStore((s) => s.isReady)

  const signInWithProvider = useCallback(
    (providerId: FederatedProviderId) =>
      authProvider.signInWithProvider(providerId),
    [],
  )
  const signInWithEmail = useCallback(
    (email: string, password: string) =>
      authProvider.signInWithEmail(email, password),
    [],
  )
  const registerWithEmail = useCallback(
    (email: string, password: string) =>
      authProvider.registerWithEmail(email, password),
    [],
  )
  const signOut = useCallback(() => authProvider.signOut(), [])

  return {
    user,
    isAuthenticated: user !== null,
    isReady,
    signInWithProvider,
    signInWithEmail,
    registerWithEmail,
    signOut,
  }
}
