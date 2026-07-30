/**
 * Runs the native Facebook Login flow and returns the access token used to
 * build a Firebase credential. Throws 'SIGN_IN_CANCELLED' on user cancellation
 * (the sign-in screen swallows it) or on a missing token.
 *
 * NOTE — iOS limited login is NOT handled here yet. On iOS without App Tracking
 * consent, Facebook forces "limited login", which returns an AuthenticationToken
 * (a JWT + nonce) instead of an AccessToken, so `getCurrentAccessToken()` is
 * null and this throws. The full cross-platform implementation is preserved,
 * commented out, at the bottom of this file — enable it (and verify on a real
 * device with the real FB app) when Facebook is unblocked for release. See
 * docs/design/2026-07-29-apple-facebook-auth-setup.md.
 *
 * The `react-native-fbsdk-next` import is deferred to call time rather than
 * hoisted to module scope: merely importing it touches a native HostObject
 * getter that throws when the SDK hasn't been initialized (true today — the
 * Facebook App ID is an unconfigured placeholder in app.json, matching
 * Facebook being version-gated off). A static import crashed every app boot
 * that reached this module.
 */
export async function getFacebookAccessToken(): Promise<string> {
  const { LoginManager, AccessToken } = await import('react-native-fbsdk-next')
  const result = await LoginManager.logInWithPermissions([
    'public_profile',
    'email',
  ])
  if (result.isCancelled) throw new Error('SIGN_IN_CANCELLED')

  const data = await AccessToken.getCurrentAccessToken()
  if (!data) throw new Error('NO_FACEBOOK_ACCESS_TOKEN')
  return data.accessToken
}

export async function facebookSignOut(): Promise<void> {
  const { LoginManager } = await import('react-native-fbsdk-next')
  LoginManager.logOut()
}

/*
 * ─── Cross-platform (standard + iOS limited login) — NOT YET ENABLED ─────────
 * Preserved for when Facebook is unblocked (real FB app + verified on device).
 * iOS uses limited login (AuthenticationToken + raw nonce); other platforms use
 * standard login (AccessToken). The provider then builds the matching Firebase
 * credential: FacebookAuthProvider.credential(idToken, nonce) for limited, or
 * FacebookAuthProvider.credential(accessToken) for standard.
 *
 * import { Platform } from 'react-native'
 * import { LoginManager, AccessToken, AuthenticationToken } from 'react-native-fbsdk-next'
 * import { randomRawNonce } from './nonce'
 *
 * export type FacebookCredentialInput =
 *   | { kind: 'accessToken'; accessToken: string }
 *   | { kind: 'limited'; idToken: string; nonce: string }
 *
 * export async function getFacebookCredentialInput(): Promise<FacebookCredentialInput> {
 *   if (Platform.OS === 'ios') {
 *     const nonce = randomRawNonce()
 *     const result = await LoginManager.logInWithPermissions(
 *       ['public_profile', 'email'],
 *       'limited',
 *       nonce,
 *     )
 *     if (result.isCancelled) throw new Error('SIGN_IN_CANCELLED')
 *     const token = await AuthenticationToken.getAuthenticationTokenIOS()
 *     if (!token) throw new Error('NO_FACEBOOK_AUTH_TOKEN')
 *     return { kind: 'limited', idToken: token.authenticationToken, nonce }
 *   }
 *   const result = await LoginManager.logInWithPermissions(['public_profile', 'email'])
 *   if (result.isCancelled) throw new Error('SIGN_IN_CANCELLED')
 *   const data = await AccessToken.getCurrentAccessToken()
 *   if (!data) throw new Error('NO_FACEBOOK_ACCESS_TOKEN')
 *   return { kind: 'accessToken', accessToken: data.accessToken }
 * }
 */
