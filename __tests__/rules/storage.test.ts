import * as fs from 'fs'
import * as path from 'path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import { ref, uploadBytes } from 'firebase/storage'

const PROJECT_ID = 'project-e3d5659d-bc4f-438f-88c'
const BUCKET_URL = 'gs://feral-spotter-image-uploads'
const SMALL_IMAGE = new Uint8Array([1, 2, 3, 4])
const OVERSIZED_IMAGE = new Uint8Array(21 * 1024 * 1024) // over the 20MB cap

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

describe('storage.rules — submissions/{uid}/{submissionId}/{fileName}', () => {
  it('owner can upload a valid image as the first photo of a new submission', async () => {
    const owner = testEnv.authenticatedContext('uid-owner')
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      'submissions/uid-owner/sub-1/photo.jpg',
    )
    await assertSucceeds(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  it('unauthenticated upload is denied', async () => {
    const anon = testEnv.unauthenticatedContext()
    const objectRef = ref(
      anon.storage(BUCKET_URL),
      'submissions/uid-owner/sub-1/photo.jpg',
    )
    await assertFails(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  it("cannot upload into another uid's folder", async () => {
    const attacker = testEnv.authenticatedContext('uid-attacker')
    const objectRef = ref(
      attacker.storage(BUCKET_URL),
      'submissions/uid-owner/sub-1/photo.jpg',
    )
    await assertFails(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  it('rejects a file over the 20MB cap', async () => {
    const owner = testEnv.authenticatedContext('uid-owner')
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      'submissions/uid-owner/sub-1/big.jpg',
    )
    await assertFails(
      uploadBytes(objectRef, OVERSIZED_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  it('rejects a disallowed content type', async () => {
    const owner = testEnv.authenticatedContext('uid-owner')
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      'submissions/uid-owner/sub-1/file.pdf',
    )
    await assertFails(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'application/pdf' }),
    )
  })

  it('allows the 10th photo when photoCount is 9', async () => {
    await seedCounter('sub-1', 'uid-owner', 9)
    const owner = testEnv.authenticatedContext('uid-owner')
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      'submissions/uid-owner/sub-1/photo-10.jpg',
    )
    await assertSucceeds(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  it('rejects the 11th photo when photoCount is already 10', async () => {
    await seedCounter('sub-1', 'uid-owner', 10)
    const owner = testEnv.authenticatedContext('uid-owner')
    const objectRef = ref(
      owner.storage(BUCKET_URL),
      'submissions/uid-owner/sub-1/photo-11.jpg',
    )
    await assertFails(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
  })

  // Regression markers, not fixes — these document the known gaps (issues
  // #267, #268) so the tests flip green the moment those land, instead of
  // the gaps silently regressing back in unnoticed.

  it('#267: any authenticated user can upload, allowlist is not enforced (should fail once #267 lands)', async () => {
    // A uid with no relationship to any tester allowlist — nothing in
    // storage.rules today checks that. This SUCCEEDING is the bug.
    const notATester = testEnv.authenticatedContext('uid-not-a-tester')
    const objectRef = ref(
      notATester.storage(BUCKET_URL),
      'submissions/uid-not-a-tester/sub-1/photo.jpg',
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
      'submissions/uid-b/shared-id/photo.jpg',
    )
    await assertFails(
      uploadBytes(objectRef, SMALL_IMAGE, { contentType: 'image/jpeg' }),
    )
  })
})
