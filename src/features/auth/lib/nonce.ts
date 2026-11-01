import * as Crypto from 'expo-crypto'

const NONCE_CHARS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._'

/** Cryptographically-random raw nonce for OIDC replay protection (Apple/Facebook). */
export function randomRawNonce(byteLength = 32): string {
  const bytes = Crypto.getRandomBytes(byteLength)
  return Array.from(bytes, (b) => NONCE_CHARS[b % NONCE_CHARS.length]).join('')
}

/** SHA-256 hex digest — Apple wants the hashed nonce; Firebase gets the raw one. */
export function sha256Hex(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input)
}
