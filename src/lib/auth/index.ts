import type { AuthUser, IAuthProvider } from './IAuthProvider'

// No real auth provider is wired yet (Firebase integration pending). In dev,
// stub sign-in so the rest of the app (home screen auth gate, submission
// flow) stays exercisable without a real Google/Firebase round trip.
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

const notImplementedProvider: IAuthProvider = {
  getToken: () => Promise.reject(new Error('NOT_IMPLEMENTED')),
  signIn: () => Promise.reject(new Error('NOT_IMPLEMENTED')),
  signOut: () => Promise.reject(new Error('NOT_IMPLEMENTED')),
  onAuthStateChanged: () => () => {},
}

export const authProvider: IAuthProvider = __DEV__
  ? createDevAuthProvider()
  : notImplementedProvider
