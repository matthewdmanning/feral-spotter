import * as fs from 'fs'
import * as path from 'path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import {
  deleteObject,
  ref,
  updateMetadata,
  uploadBytes,
} from 'firebase/storage'

const PROJECT_ID = 'project-e3d5659d-bc4f-438f-88c'
const BUCKET_URL = 'gs://feral-spotter-image-uploads'
const SMALL_IMAGE = new Uint8Array([1, 2, 3, 4])
const OVERSIZED_IMAGE = new Uint8Array(21 * 1024 * 1024) // over the 20MB cap
const SMALL_JSON = new Uint8Array([0x7b, 0x7d]) // '{}'
const OVERSIZED_JSON = new Uint8Array(257 * 1024) // over the 256KB cap

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
  ownerUid: string,
  photoCount: number,
) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'submissions', submissionId), {
      ownerUid,
      photoCount,
    })
  })
}

const OWNER_UID = 'uid-owner'

describe('storage.rules — submissions/{uid}/{submissionId}/{fileName}', () => {
  it('owner can upload a valid image as the first photo of a new submission', async () => {
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_UID}/sub-1/photo.jpg`,
    )
    await assertSucceeds(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  it('unauthenticated upload is denied', async () => {
    const anon = testEnv.unauthenticatedContext()
    const objectRef = ref(
      anon.storage(BUCKET_URL),
      `submissions/${OWNER_UID}/sub-1/photo.jpg`,
    )
    await assertFails(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  it("cannot upload into another uid's folder", async () => {
    const attacker = testEnv.authenticatedContext('uid-attacker')
    const objectRef = ref(
      attacker.storage(BUCKET_URL),
      `submissions/${OWNER_UID}/sub-1/photo.jpg`,
    )
    await assertFails(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  it('rejects a file over the 20MB cap', async () => {
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_UID}/sub-1/big.jpg`,
    )
    await assertFails(
      uploadBytes(objectRef, OVERSIZED_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  it('rejects a disallowed content type', async () => {
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_UID}/sub-1/file.pdf`,
    )
    await assertFails(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'application/pdf' }),
    )
  })

  it('allows the 10th photo when photoCount is 9', async () => {
    await seedCounter('sub-1', OWNER_UID, 9)
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_UID}/sub-1/photo-10.jpg`,
    )
    await assertSucceeds(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  it('rejects the 11th photo when photoCount is already 10', async () => {
    await seedCounter('sub-1', OWNER_UID, 10)
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_UID}/sub-1/photo-11.jpg`,
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
      `submissions/${OWNER_UID}/sub-1/photo-1.jpg`,
    )
    await assertSucceeds(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
    await seedCounter('sub-1', OWNER_UID, 10)

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
      `submissions/${OWNER_UID}/sub-1/metadata.json`,
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
      `submissions/${OWNER_UID}/sub-1/metadata.json`,
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
      `submissions/${OWNER_UID}/sub-1/metadata.json`,
    )
    await assertFails(
      uploadBytes(objectRef, SMALL_JSON, { contentType: 'application/json' }),
    )
  })

  it('rejects metadata.json over the 256KB cap', async () => {
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_UID}/sub-1/metadata.json`,
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
      `submissions/${OWNER_UID}/sub-1/metadata.json`,
    )
    await assertFails(
      uploadBytes(objectRef, SMALL_JSON, { contentType: 'text/plain' }),
    )
  })

  it('metadata.json write bypasses the photoCount cap (not photo-gated by design)', async () => {
    await seedCounter('sub-1', OWNER_UID, 10)
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_UID}/sub-1/metadata.json`,
    )
    await assertSucceeds(
      uploadBytes(objectRef, SMALL_JSON, { contentType: 'application/json' }),
    )
  })

  // No allowlist gate in storage.rules today.
  it('#267: no allowlist gate — any authenticated user can upload', async () => {
    const uid = 'uid-not-a-tester'
    const user = testEnv.authenticatedContext(uid)
    const objectRef = ref(
      user.storage(BUCKET_URL),
      `submissions/${uid}/sub-1/photo.jpg`,
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
    await seedCounter('shared-id', 'uid-a', 10)
    const uidB = testEnv.authenticatedContext('uid-b')
    const objectRef = ref(
      uidB.storage(BUCKET_URL),
      `submissions/uid-b/shared-id/photo.jpg`,
    )
    await assertFails(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  // ── #293: delete branch ──────────────────────────────────────────────────

  it('#293: owner can delete their own photo', async () => {
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_UID}/sub-del/photo.jpg`,
    )
    await assertSucceeds(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
    await assertSucceeds(deleteObject(objectRef))
  })

  it('#293: owner can delete their own metadata.json', async () => {
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_UID}/sub-del/metadata.json`,
    )
    await assertSucceeds(
      uploadBytes(objectRef, SMALL_JSON, { contentType: 'application/json' }),
    )
    await assertSucceeds(deleteObject(objectRef))
  })

  it("#293: a different authenticated user cannot delete someone else's photo", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(
        ref(
          context.storage(BUCKET_URL),
          `submissions/${OWNER_UID}/sub-del/photo.jpg`,
        ),
        SMALL_IMAGE,
        { contentType: 'image/jpeg' },
      )
    })
    const other = testEnv.authenticatedContext('uid-other')
    await assertFails(
      deleteObject(
        ref(
          other.storage(BUCKET_URL),
          `submissions/${OWNER_UID}/sub-del/photo.jpg`,
        ),
      ),
    )
  })

  it('#293: unauthenticated delete is denied', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(
        ref(
          context.storage(BUCKET_URL),
          `submissions/${OWNER_UID}/sub-del/photo.jpg`,
        ),
        SMALL_IMAGE,
        { contentType: 'image/jpeg' },
      )
    })
    const anon = testEnv.unauthenticatedContext()
    await assertFails(
      deleteObject(
        ref(
          anon.storage(BUCKET_URL),
          `submissions/${OWNER_UID}/sub-del/photo.jpg`,
        ),
      ),
    )
  })

  it('#293: splitting write into create/update did not loosen the upload validators — oversized image still denied', async () => {
    const owner = testEnv.authenticatedContext(OWNER_UID)
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      `submissions/${OWNER_UID}/sub-big/photo.jpg`,
    )
    await assertFails(
      uploadBytes(objectRef, OVERSIZED_IMAGE, { contentType: 'image/jpeg' }),
    )
  })
})
