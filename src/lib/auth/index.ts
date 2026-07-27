import type { AuthUser, IAuthProvider } from './IAuthProvider'
import { createFirebaseAuthProvider } from './firebaseAuthProvider'

// Firebase Auth's native module isn't available under Jest, so tests get a
// stub. Everything else — dev and prod, device and emulator — gets real
// Firebase; __DEV__ is true under Jest too, so it can't be the gate here.
const DEV_STUB_USER: AuthUser = { uid: 'dev-stub-uid', email: 'dev@feralspotter.local' }

function createDevAuthProvider(): IAuthProvider {
  let currentUser: AuthUser | null = null
  const listeners = new Set<(user: AuthUser | null) => void>()

  const notify = () => listeners.forEach((cb) => cb(currentUser))

  return {
    getToken: async () => {
      if (!currentUser) throw new Error('NOT_SIGNED_IN')
      return 'dev-stub-token'
    },
    getCurrentUser: () => currentUser,
    signIn: async () => {
      currentUser = DEV_STUB_USER
      notify()
      return currentUser
    },
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

export const authProvider: IAuthProvider = isJest
  ? createDevAuthProvider()
  : createFirebaseAuthProvider()
