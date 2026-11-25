import {
  getAuth,
  connectAuthEmulator,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  FacebookAuthProvider,
  onAuthStateChanged,
  updateProfile,
  verifyBeforeUpdateEmail,
  signOut as firebaseSignOut,
  type User,
} from '@react-native-firebase/auth'
import type { AuthUser, IAuthProvider, SignInMethod } from './IAuthProvider'
import {
  assertFederatedProviderReleased,
  type FederatedProviderId,
} from './authProviders'
import { getGoogleTokens, googleSignOut } from './GoogleSignIn'
import { getAppleCredentialInput } from './AppleSignIn'
import { getFacebookAccessToken, facebookSignOut } from './FacebookSignIn'
import {
  AUTH_EMULATOR_PORT,
  USE_FIREBASE_EMULATOR,
  FIREBASE_EMULATOR_HOST,
} from '@/src/shared/config/constants'

const SIGN_IN_METHODS: Record<string, SignInMethod> = {
  password: 'password',
  'google.com': 'google',
  'apple.com': 'apple',
  'facebook.com': 'facebook',
}

function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null
  return { uid: user.uid, email: user.email, displayName: user.displayName }
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
    const emulatorUrl = `http://${FIREBASE_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`
    connectAuthEmulator(auth, emulatorUrl)
    // connectAuthEmulator never fails on its own — it just points the SDK at
    // this URL. If nothing's actually listening there, sign-in would only
    // fail later with a generic network error. Ping it now so a forgotten
    // `firebase emulators:start` is loud and immediate instead.
    fetch(emulatorUrl).catch(() => {
      console.error(
        `[firebaseAuthProvider] EXPO_PUBLIC_USE_FIREBASE_EMULATOR is set but the Auth emulator at ${FIREBASE_EMULATOR_HOST}:${AUTH_EMULATOR_PORT} is unreachable. Run \`firebase emulators:start\` before test-driving in emulator mode.`,
      )
    })
  }

  // Firebase reports sign-in before Registration sets the profile name, and a
  // profile update fires no auth event, so Registration re-notifies listeners.
  const listeners = new Set<(user: AuthUser | null) => void>()

  return {
    getToken: async (forceRefresh = false) => {
      const user = auth.currentUser
      if (!user) throw new Error('NOT_SIGNED_IN')
      // Non-force-refresh: a still-valid cached token resolves without a
      // network round trip. An expired one is refreshed over the network,
      // so offline it rejects; callers treat that as a failed request.
      return user.getIdToken(forceRefresh)
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
    registerWithEmail: async (email, password, displayName) => {
      const { user } = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      )
      await updateProfile(user, { displayName })
      const named = { ...(toAuthUser(user) as AuthUser), displayName }
      listeners.forEach((cb) => cb(named))
      return named
    },
    changeEmail: async (newEmail) => {
      const user = auth.currentUser
      if (!user) throw new Error('NOT_SIGNED_IN')
      await verifyBeforeUpdateEmail(user, newEmail)
    },
    signInMethod: () => {
      const providers = auth.currentUser?.providerData ?? []
      for (const { providerId } of providers) {
        const method = SIGN_IN_METHODS[providerId]
        if (method) return method
      }
      return null
    },
    reauthenticate: async (password) => {
      const user = auth.currentUser
      if (!user) throw new Error('NOT_SIGNED_IN')
      const method = SIGN_IN_METHODS[user.providerData[0]?.providerId ?? '']
      if (!method) throw new Error('UNSUPPORTED_PROVIDER')
      const credential =
        method === 'password'
          ? EmailAuthProvider.credential(user.email ?? '', password ?? '')
          : await credentialForProvider(method)
      await reauthenticateWithCredential(user, credential)
    },
    signOut: async () => {
      // Sign out of every federated SDK that keeps its own session, then Firebase.
      await Promise.allSettled([googleSignOut(), facebookSignOut()])
      await firebaseSignOut(auth)
    },
    onAuthStateChanged: (cb) => {
      listeners.add(cb)
      const unsubscribe = onAuthStateChanged(auth, (user) =>
        cb(toAuthUser(user)),
      )
      return () => {
        listeners.delete(cb)
        unsubscribe()
      }
    },
  }
}
