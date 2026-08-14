import { createHash } from 'crypto'
import { USER_ID_HASH_SALT } from '@/src/config/constants'
import { hashUid } from '@/src/lib/upload/firebaseUpload'

// Real SHA-256/hex behind the native module boundary, so this test catches
// bugs in hashUid()'s own logic (salt placement, wrong algorithm/encoding
// constant) — not a substitute for confirming Firebase's native SHA-256
// agrees byte-for-byte with storage.rules'/firestore.rules' hashing.sha256()
// .toHexString(), which needs the emulator (see docs/adr/0005) and can't be
// checked here.
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  digestStringAsync: jest.fn((algorithm: string, data: string) => {
    if (algorithm !== 'SHA-256')
      throw new Error(`unexpected algorithm ${algorithm}`)
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't reference outer-scope imports
    const { createHash } = require('crypto')
    return Promise.resolve(createHash('sha256').update(data).digest('hex'))
  }),
}))

describe('hashUid', () => {
  it('salts before hashing and returns lowercase hex, matching storage.rules/firestore.rules', async () => {
    const expected = createHash('sha256')
      .update(USER_ID_HASH_SALT + 'uid-owner')
      .digest('hex')

    await expect(hashUid('uid-owner')).resolves.toBe(expected)
  })

  it('is deterministic — the same uid always resolves to the same path/customMetadata value', async () => {
    await expect(hashUid('uid-owner')).resolves.toBe(await hashUid('uid-owner'))
  })

  it('salt actually changes the output — not equivalent to unsalted sha256(uid)', async () => {
    const unsalted = createHash('sha256').update('uid-owner').digest('hex')
    await expect(hashUid('uid-owner')).resolves.not.toBe(unsalted)
  })
})
