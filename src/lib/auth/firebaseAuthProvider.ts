import {
  getAuth,
  connectAuthEmulator,
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
import {
  assertFederatedProviderReleased,
  type FederatedProviderId,
} from './authProviders'
import { getGoogleTokens, googleSignOut } from './GoogleSignIn'
import { getAppleCredentialInput } from './AppleSignIn'
import { getFacebookAccessToken, facebookSignOut } from './FacebookSignIn'
import {
  USE_FIREBASE_EMULATOR,
  FIREBASE_EMULATOR_HOST,
} from '@/src/config/constants'

function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null
  return { uid: user.uid, email: user.email }
}

async function credentialForProvider(providerId: FederatedProviderId) {
  // Decorator-style gate: blocks not-yet-released providers (Apple/Facebook)
  // from running their unverified native flow until their version tag is met.
  assertFederatedProviderReleased(providerId)

  switch (providerId) {
    case 'google': {
      const tokens = await getGoogleTokens()
      if (!tokens) throw new Error('NO_GOOGLE_ID_TOKEN')
      return GoogleAuthProvider.credential(tokens.idToken, tokens.accessToken)
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

  if (USE_FIREBASE_EMULATOR) {
    connectAuthEmulator(auth, `http://${FIREBASE_EMULATOR_HOST}:9099`)
  }

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
