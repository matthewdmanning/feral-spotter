import {
  getAuth,
  signInWithCredential,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from '@react-native-firebase/auth'
import type { AuthUser, IAuthProvider } from './IAuthProvider'
import { getGoogleIdToken, googleSignOut } from './GoogleSignIn'

function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null
  return { uid: user.uid, email: user.email }
}

export function createFirebaseAuthProvider(): IAuthProvider {
  const auth = getAuth()

  return {
    getToken: async () => {
      const user = auth.currentUser
      if (!user) throw new Error('NOT_SIGNED_IN')
      // Non-force-refresh: an expired-but-cached token still resolves offline,
      // rather than blocking on a network round trip to refresh it.
      return user.getIdToken(false)
    },
    getCurrentUser: () => toAuthUser(auth.currentUser),
    signIn: async () => {
      const idToken = await getGoogleIdToken()
      if (!idToken) throw new Error('NO_GOOGLE_ID_TOKEN')
      const credential = GoogleAuthProvider.credential(idToken)
      const { user } = await signInWithCredential(auth, credential)
      return toAuthUser(user) as AuthUser
    },
    signOut: async () => {
      await googleSignOut()
      await firebaseSignOut(auth)
    },
    onAuthStateChanged: (cb) => onAuthStateChanged(auth, (user) => cb(toAuthUser(user))),
  }
}
