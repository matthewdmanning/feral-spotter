import * as AppleAuthentication from 'expo-apple-authentication'
import { randomRawNonce, sha256Hex } from './nonce'

export interface AppleCredentialInput {
  identityToken: string
  rawNonce: string
}

/**
 * Runs the native Sign in with Apple flow and returns the pieces needed to
 * build a Firebase credential. Apple signs a SHA-256 hash of the nonce into the
 * identity token; Firebase re-derives that hash from the raw nonce to prove the
 * token was minted for this request (replay protection).
 */
export async function getAppleCredentialInput(): Promise<AppleCredentialInput> {
  const rawNonce = randomRawNonce()
  const hashedNonce = await sha256Hex(rawNonce)

  let credential: AppleAuthentication.AppleAuthenticationCredential
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    })
  } catch (err) {
    // User dismissing the Apple sheet is not an error — surface a typed
    // cancellation the sign-in screen swallows silently.
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      err.code === 'ERR_REQUEST_CANCELED'
    ) {
      throw new Error('SIGN_IN_CANCELLED')
    }
    throw err
  }

  if (!credential.identityToken) throw new Error('NO_APPLE_IDENTITY_TOKEN')
  return { identityToken: credential.identityToken, rawNonce }
}
