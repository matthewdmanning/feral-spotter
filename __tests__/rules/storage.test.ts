import { createHash } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import { ref, updateMetadata, uploadBytes } from 'firebase/storage'

const PROJECT_ID = 'project-e3d5659d-bc4f-438f-88c'
const BUCKET_URL = 'gs://feral-spotter-image-uploads'
const SMALL_IMAGE = new Uint8Array([1, 2, 3, 4])
const OVERSIZED_IMAGE = new Uint8Array(21 * 1024 * 1024) // over the 20MB cap
const SMALL_JSON = new Uint8Array([0x7b, 0x7d]) // '{}'
const OVERSIZED_JSON = new Uint8Array(257 * 1024) // over the 256KB cap

// Must match USER_ID_HASH_SALT (src/config/constants.ts) and the literal
// baked into storage.rules/firestore.rules (docs/adr/0005) — object paths
// are keyed by this hash, not the raw uid, so every test uid below has to
// go through it to land in the folder its own rules check will look for.
// Node's crypto.createHash presumably agrees byte-for-byte with the rules
// language's hashing.sha256().toHexString(), but that can't be confirmed
// against the real emulator here (JDK 17 vs firebase-tools' JDK 21
// requirement) — if this whole suite starts failing on "owner" cases, a
// hex-casing or encoding mismatch between the two is the first thing to
// check.
const USER_ID_HASH_SALT = 'feralspotter-photo-metadata-uid-v1'
function uidHash(uid: string): string {
  return createHash('sha256')
    .update(USER_ID_HASH_SALT + uid)
    .digest('hex')
}

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(
        path.resolve(__dirname, '../../firestore.rules'),
        'utf8',
      ),
    },
    storage: {
      rules: fs.readFileSync(
        path.resolve(__dirname, '../../storage.rules'),
        'utf8',
      ),
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

afterEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.clearStorage()
})

async function seedCounter(
  submissionId: string,
  ownerUidHash: string,
  photoCount: number,
) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'submissions', submissionId), {
      ownerUidHash,
      photoCount,
    })
  })
}

const OWNER_UID = 'uid-owner'
const OWNER_HASH = uidHash(OWNER_UID)

describe('storage.rules — submissions/{uidHash}/{submissionId}/{fileName}', () => {
  it('owner can upload a valid image as the first photo of a new submission', async () => {
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_HASH}/sub-1/photo.jpg`,
    )
    await assertSucceeds(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  it('unauthenticated upload is denied', async () => {
    const anon = testEnv.unauthenticatedContext()
    const objectRef = ref(
      anon.storage(BUCKET_URL),
      `submissions/${OWNER_HASH}/sub-1/photo.jpg`,
    )
    await assertFails(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  it("cannot upload into another uid's folder", async () => {
    const attacker = testEnv.authenticatedContext('uid-attacker')
    const objectRef = ref(
      attacker.storage(BUCKET_URL),
      `submissions/${OWNER_HASH}/sub-1/photo.jpg`,
    )
    await assertFails(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  it('rejects a file over the 20MB cap', async () => {
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_HASH}/sub-1/big.jpg`,
    )
    await assertFails(
      uploadBytes(objectRef, OVERSIZED_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  it('rejects a disallowed content type', async () => {
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_HASH}/sub-1/file.pdf`,
    )
    await assertFails(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'application/pdf' }),
    )
  })

  it('allows the 10th photo when photoCount is 9', async () => {
    await seedCounter('sub-1', OWNER_HASH, 9)
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_HASH}/sub-1/photo-10.jpg`,
    )
    await assertSucceeds(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  it('rejects the 11th photo when photoCount is already 10', async () => {
    await seedCounter('sub-1', OWNER_HASH, 10)
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_HASH}/sub-1/photo-11.jpg`,
    )
    await assertFails(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  // #264: finalizeSubmissionPhotoMetadata patches an already-counted photo's
  // customMetadata at Submit — must not get blocked by the count gate just
  // because the submission is already full.
  it("allows a metadata-only patch on the owner's own already-uploaded photo, even when photoCount is at the 10 cap", async () => {
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_HASH}/sub-1/photo-1.jpg`,
    )
    await assertSucceeds(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
    await seedCounter('sub-1', OWNER_HASH, 10)

    await assertSucceeds(
      updateMetadata(objectRef, {
        customMetadata: { photo_time: '2026-08-01T10:00:00.000Z' },
      }),
    )
  })

  it('owner can upload valid submission metadata.json', async () => {
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_HASH}/sub-1/metadata.json`,
    )
    await assertSucceeds(
      uploadBytes(objectRef, SMALL_JSON, { contentType: 'application/json' }),
    )
  })

  it('owner can upload metadata.json with a charset suffix on the content type', async () => {
    // Native uploadString() may send this instead of the bare mime type.
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_HASH}/sub-1/metadata.json`,
    )
    await assertSucceeds(
      uploadBytes(objectRef, SMALL_JSON, {
        contentType: 'application/json; charset=utf-8',
      }),
    )
  })

  it("cannot upload metadata.json into another uid's folder", async () => {
    const attacker = testEnv.authenticatedContext('uid-attacker')
    const objectRef = ref(
      attacker.storage(BUCKET_URL),
      `submissions/${OWNER_HASH}/sub-1/metadata.json`,
    )
    await assertFails(
      uploadBytes(objectRef, SMALL_JSON, { contentType: 'application/json' }),
    )
  })

  it('rejects metadata.json over the 256KB cap', async () => {
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_HASH}/sub-1/metadata.json`,
    )
    await assertFails(
      uploadBytes(objectRef, OVERSIZED_JSON, {
        contentType: 'application/json',
      }),
    )
  })

  it('rejects metadata.json with a non-JSON content type', async () => {
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_HASH}/sub-1/metadata.json`,
    )
    await assertFails(
      uploadBytes(objectRef, SMALL_JSON, { contentType: 'text/plain' }),
    )
  })

  it('metadata.json write bypasses the photoCount cap (not photo-gated by design)', async () => {
    await seedCounter('sub-1', OWNER_HASH, 10)
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_HASH}/sub-1/metadata.json`,
    )
    await assertSucceeds(
      uploadBytes(objectRef, SMALL_JSON, { contentType: 'application/json' }),
    )
  })

  // Regression markers, not fixes — these document the known gaps (issues
  // #267, #268) so the tests flip green the moment those land, instead of
  // the gaps silently regressing back in unnoticed.

  it('#267: any authenticated user can upload, allowlist is not enforced (should fail once #267 lands)', async () => {
    // A uid with no relationship to any tester allowlist — nothing in
    // storage.rules today checks that. This SUCCEEDING is the bug.
    const notATesterUid = 'uid-not-a-tester'
    const notATester = testEnv.authenticatedContext(notATesterUid)
    const objectRef = ref(
      notATester.storage(BUCKET_URL),
      `submissions/${uidHash(notATesterUid)}/sub-1/photo.jpg`,
    )
    await assertSucceeds(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  it("#268: a second uid's upload is gated by the first uid's counter when submissionId collides (should fail once #268 lands)", async () => {
    // uid-A already has 10 photos on "shared-id". uid-B, using the same
    // submissionId under their own uid folder, gets blocked by uid-A's
    // count — cross-tenant coupling through the flat counter doc. This
    // SUCCEEDING as a *rejection for uid-B* (who has 0 real photos) proves
    // the collision; once #268 scopes the counter per uid, uid-B's upload
    // should succeed instead.
    const uidBRaw = 'uid-b'
    await seedCounter('shared-id', uidHash('uid-a'), 10)
    const uidB = testEnv.authenticatedContext(uidBRaw)
    const objectRef = ref(
      uidB.storage(BUCKET_URL),
      `submissions/${uidHash(uidBRaw)}/shared-id/photo.jpg`,
    )
    await assertFails(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
  })
})
