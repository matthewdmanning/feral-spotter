import { authProvider } from '@/src/lib/auth'
import { useAuthStore } from '@/src/lib/auth/authStore'

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const isReady = useAuthStore((s) => s.isReady)

  return {
    user,
    isAuthenticated: user !== null,
    isReady,
    signInWithProvider: authProvider.signInWithProvider,
    signInWithEmail: authProvider.signInWithEmail,
    registerWithEmail: authProvider.registerWithEmail,
    signOut: authProvider.signOut,
  }
}
