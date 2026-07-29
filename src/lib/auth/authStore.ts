/**
 * lib/auth/authStore.ts
 * Single source of truth for auth state, reactive across the whole app.
 *
 * Subscribes to authProvider.onAuthStateChanged exactly once at module load
 * (not per-component) so state lives outside any component's lifecycle —
 * a component mounting fresh reads whatever the store currently holds
 * immediately, instead of starting from a placeholder and correcting one
 * render later. That per-mount placeholder-then-correct flash (every fresh
 * mount of a `useState(null)`-based useAuth briefly rendering
 * isAuthenticated=false) is what caused #93's registration→consent loop:
 * a gate effect acted on the transient false before the real value landed.
 *
 * isReady stays false until the provider has reported at least once —
 * consumers must treat auth as indeterminate (no redirects) until then.
 * Required for a real async provider (Firebase cold-start session restore),
 * not just this dev stub.
 */

import { authProvider } from '@/src/lib/auth'
import type { AuthUser } from '@/src/lib/auth/IAuthProvider'
import { create } from 'zustand'

interface AuthState {
  user: AuthUser | null
  isReady: boolean
}

export const useAuthStore = create<AuthState>(() => ({
  user: authProvider.getCurrentUser(),
  isReady: false,
}))

authProvider.onAuthStateChanged((user) => {
  useAuthStore.setState({ user, isReady: true })
})
