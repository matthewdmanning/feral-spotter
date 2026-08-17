import type { AuthUser, IAuthProvider } from './IAuthProvider'
import { createFirebaseAuthProvider } from './firebaseAuthProvider'
import { USE_FIREBASE_EMULATOR } from '@/src/config/constants'

// Firebase Auth's native module isn't available under Jest, so tests get a
// stub. Everything else — dev and prod, device and emulator — gets real
// Firebase; __DEV__ is true under Jest too, so it can't be the gate here.
const DEV_STUB_USER: AuthUser = {
  uid: 'dev-stub-uid',
  email: 'dev@feralspotter.local',
}

function createDevAuthProvider(): IAuthProvider {
  let currentUser: AuthUser | null = null
  const listeners = new Set<(user: AuthUser | null) => void>()

  const notify = () => listeners.forEach((cb) => cb(currentUser))

  const grantStub = async () => {
    currentUser = DEV_STUB_USER
    notify()
    return currentUser
  }

  return {
    getToken: async () => {
      if (!currentUser) throw new Error('NOT_SIGNED_IN')
      return 'dev-stub-token'
    },
    getCurrentUser: () => currentUser,
    // Every sign-in path grants the same stub — the mock exists to walk the
    // gated flow without a real provider, so it ignores which one was used.
    signInWithProvider: grantStub,
    signInWithEmail: grantStub,
    registerWithEmail: grantStub,
    signOut: async () => {
      currentUser = null
      notify()
    },
    onAuthStateChanged: (cb) => {
      listeners.add(cb)
      cb(currentUser)
      return () => listeners.delete(cb)
    },
  }
}

const isJest = process.env.JEST_WORKER_ID !== undefined

// Dev-only sign-in bypass: any sign-in attempt immediately grants a stub user,
// so the auth-gated flow can be walked on a device without a real Google
// account. Double-guarded — `__DEV__` means a release build can never enable it
// even if the env var leaks in, and the flag is opt-in via gitignored .env.local.
const useMockAuth = __DEV__ && process.env.EXPO_PUBLIC_AUTH_MOCK === 'true'

if (!isJest) {
  const mode = useMockAuth
    ? 'mock'
    : USE_FIREBASE_EMULATOR
      ? 'emulator'
      : 'live'
  console.log(`[firebase] mode: ${mode}`)
}

export const authProvider: IAuthProvider =
  isJest || useMockAuth ? createDevAuthProvider() : createFirebaseAuthProvider()
