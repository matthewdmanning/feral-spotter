import {
  getAuth,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  FacebookAuthProvider,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from '@react-native-firebase/auth'
import type { AuthUser, IAuthProvider } from './IAuthProvider'
import type { FederatedProviderId } from './authProviders'
import { getGoogleIdToken, googleSignOut } from './GoogleSignIn'
import { getAppleCredentialInput } from './AppleSignIn'
import { getFacebookAccessToken, facebookSignOut } from './FacebookSignIn'

function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null
  return { uid: user.uid, email: user.email }
}

async function credentialForProvider(providerId: FederatedProviderId) {
  switch (providerId) {
    case 'google': {
      const idToken = await getGoogleIdToken()
      if (!idToken) throw new Error('NO_GOOGLE_ID_TOKEN')
      return GoogleAuthProvider.credential(idToken)
    }
    case 'apple': {
      const { identityToken, rawNonce } = await getAppleCredentialInput()
      // v25: AppleAuthProvider is deprecated in favour of OAuthProvider('apple.com').
      return new OAuthProvider('apple.com').credential({
        idToken: identityToken,
        rawNonce,
      })
    }
    case 'facebook': {
      const accessToken = await getFacebookAccessToken()
      return FacebookAuthProvider.credential(accessToken)
    }
    default:
      throw new Error(`UNSUPPORTED_PROVIDER: ${providerId as string}`)
  }
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
    signInWithProvider: async (providerId) => {
      const credential = await credentialForProvider(providerId)
      const { user } = await signInWithCredential(auth, credential)
      return toAuthUser(user) as AuthUser
    },
    signInWithEmail: async (email, password) => {
      const { user } = await signInWithEmailAndPassword(auth, email, password)
      return toAuthUser(user) as AuthUser
    },
    registerWithEmail: async (email, password) => {
      const { user } = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      )
      return toAuthUser(user) as AuthUser
    },
    signOut: async () => {
      // Sign out of every federated SDK that keeps its own session, then Firebase.
      await Promise.allSettled([googleSignOut(), facebookSignOut()])
      await firebaseSignOut(auth)
    },
    onAuthStateChanged: (cb) =>
      onAuthStateChanged(auth, (user) => cb(toAuthUser(user))),
  }
}
