import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'

const NONCE_CHARS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._'

function randomRawNonce(byteLength = 32): string {
  const bytes = Crypto.getRandomBytes(byteLength)
  return Array.from(bytes, (b) => NONCE_CHARS[b % NONCE_CHARS.length]).join('')
}

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
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  )

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  })

  if (!credential.identityToken) throw new Error('NO_APPLE_IDENTITY_TOKEN')
  return { identityToken: credential.identityToken, rawNonce }
}
