import { authProvider } from '@/src/features/auth/lib'
import { useAuthStore } from '@/src/features/auth/lib/authStore'

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
    changeEmail: authProvider.changeEmail,
    signOut: authProvider.signOut,
  }
}
