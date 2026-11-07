import * as fs from 'fs'
import * as path from 'path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  deleteObject,
  getMetadata,
  listAll,
  type StorageReference,
  ref,
  updateMetadata,
  uploadBytes,
} from 'firebase/storage'

// A demo- project runs against the emulators only and needs no real project.
// The rules match every bucket ({bucket}), so the bucket is local too.
const PROJECT_ID = 'demo-feral-spotter'
const BUCKET_URL = `gs://${PROJECT_ID}.appspot.com`
const SMALL_IMAGE = new Uint8Array([1, 2, 3, 4])
const OVERSIZED_IMAGE = new Uint8Array(21 * 1024 * 1024) // over the 20MB cap
const SMALL_JSON = new Uint8Array([0x7b, 0x7d]) // '{}'
const OVERSIZED_JSON = new Uint8Array(257 * 1024) // over the 256KB cap
const OWNER_UID = 'uid-owner'
const JPEG = { contentType: 'image/jpeg' }
const JSON_TYPE = { contentType: 'application/json' }

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
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
  // clearStorage() only clears the default bucket's root items.
  await testEnv.withSecurityRulesDisabled((context) =>
    clearPrefix(ref(context.storage(BUCKET_URL))),
  )
})

async function clearPrefix(prefix: StorageReference): Promise<void> {
  const { items, prefixes } = await listAll(prefix)
  await Promise.all(items.map((item) => deleteObject(item)))
  await Promise.all(prefixes.map((child) => clearPrefix(child)))
}

const objectAt = (
  uid: string | null,
  name: string,
  claims?: Record<string, unknown>,
) => {
  const context = uid
    ? testEnv.authenticatedContext(uid, claims)
    : testEnv.unauthenticatedContext()
  return ref(context.storage(BUCKET_URL), name)
}
const photoOf = (uid: string | null, file = 'photo-0.jpg', sub = 'sub-1') =>
  objectAt(uid, `submissions/${OWNER_UID}/${sub}/${file}`)
const metadataOf = (claims?: Record<string, unknown>, sub = 'sub-1') =>
  objectAt(OWNER_UID, `submissions/${OWNER_UID}/${sub}/metadata.json`, claims)

describe('storage.rules — photos', () => {
  it('lets the owner upload a valid image into a slot', async () => {
    await assertSucceeds(uploadBytes(photoOf(OWNER_UID), SMALL_IMAGE, JPEG))
  })

  it('denies an unauthenticated upload and an upload into another uid', async () => {
    await assertFails(uploadBytes(photoOf(null), SMALL_IMAGE, JPEG))
    await assertFails(uploadBytes(photoOf('uid-attacker'), SMALL_IMAGE, JPEG))
  })

  it('rejects an oversized file and a non-image type', async () => {
    await assertFails(uploadBytes(photoOf(OWNER_UID), OVERSIZED_IMAGE, JPEG))
    await assertFails(
      uploadBytes(photoOf(OWNER_UID), SMALL_IMAGE, {
        contentType: 'application/pdf',
      }),
    )
  })

  // The 10-photo cap is the object name: photo-0 … photo-9 only.
  it.each([
    ['photo-9.jpg', true],
    ['photo-0.heic', true],
    ['photo-10.jpg', false],
    ['photo.jpg', false],
    ['3f2a.jpg', false],
    ['photo-1.pdf', false],
  ])('slot name %s allowed: %s', async (file, allowed) => {
    const write = uploadBytes(photoOf(OWNER_UID, file), SMALL_IMAGE, JPEG)
    await (allowed ? assertSucceeds(write) : assertFails(write))
  })

  it('lets a slot be replaced and its customMetadata patched', async () => {
    const photo = photoOf(OWNER_UID)
    await assertSucceeds(uploadBytes(photo, SMALL_IMAGE, JPEG))
    await assertSucceeds(uploadBytes(photo, new Uint8Array([9, 9]), JPEG))
    await assertSucceeds(
      updateMetadata(photo, {
        customMetadata: { photo_time: '2026-08-01T10:00:00.000Z' },
      }),
    )
  })

  it('still rejects a non-image overwrite of a slot', async () => {
    const photo = photoOf(OWNER_UID)
    await assertSucceeds(uploadBytes(photo, SMALL_IMAGE, JPEG))
    await assertFails(
      uploadBytes(photo, SMALL_IMAGE, { contentType: 'text/html' }),
    )
  })

  it('rejects a user_id in metadata that names someone else', async () => {
    const photo = photoOf(OWNER_UID)
    await assertFails(
      uploadBytes(photo, SMALL_IMAGE, {
        ...JPEG,
        customMetadata: { user_id: 'uid-other' },
      }),
    )
    await assertSucceeds(
      uploadBytes(photo, SMALL_IMAGE, {
        ...JPEG,
        customMetadata: { user_id: OWNER_UID },
      }),
    )
    await assertFails(
      updateMetadata(photo, { customMetadata: { user_id: 'uid-other' } }),
    )
  })

  // #267 is deferred: no allowlist gate yet.
  it('lets any authenticated user upload into their own folder', async () => {
    const stranger = objectAt(
      'uid-stranger',
      'submissions/uid-stranger/sub-1/photo-0.jpg',
    )
    await assertSucceeds(uploadBytes(stranger, SMALL_IMAGE, JPEG))
  })
})

describe('storage.rules — metadata.json', () => {
  it('accepts JSON, with or without a charset suffix', async () => {
    await assertSucceeds(uploadBytes(metadataOf(), SMALL_JSON, JSON_TYPE))
    await assertSucceeds(
      uploadBytes(metadataOf(), SMALL_JSON, {
        contentType: 'application/json; charset=utf-8',
      }),
    )
  })

  it('rejects another uid, an oversized blob and a non-JSON type', async () => {
    const theirs = objectAt(
      'uid-attacker',
      `submissions/${OWNER_UID}/sub-1/metadata.json`,
    )
    await assertFails(uploadBytes(theirs, SMALL_JSON, JSON_TYPE))
    await assertFails(uploadBytes(metadataOf(), OVERSIZED_JSON, JSON_TYPE))
    await assertFails(
      uploadBytes(metadataOf(), SMALL_JSON, { contentType: 'text/plain' }),
    )
  })

  // #270: functions/ sets submissionCapReached at 250 Submissions.
  it('refuses a new Submission at the cap but lets a counted one be resent', async () => {
    const atCap = { submissionCapReached: true }
    await assertSucceeds(
      uploadBytes(metadataOf(undefined, 'sub-counted'), SMALL_JSON, JSON_TYPE),
    )
    await assertSucceeds(
      uploadBytes(metadataOf(atCap, 'sub-counted'), SMALL_JSON, JSON_TYPE),
    )
    await assertFails(
      uploadBytes(metadataOf(atCap, 'sub-new'), SMALL_JSON, JSON_TYPE),
    )
    await assertSucceeds(
      uploadBytes(
        metadataOf({ submissionCapReached: false }, 'sub-new'),
        SMALL_JSON,
        JSON_TYPE,
      ),
    )
  })
})

describe('storage.rules — deletes (#293)', () => {
  it('lets only the owner delete their objects', async () => {
    await assertSucceeds(uploadBytes(photoOf(OWNER_UID), SMALL_IMAGE, JPEG))
    await assertSucceeds(uploadBytes(metadataOf(), SMALL_JSON, JSON_TYPE))
    await assertFails(deleteObject(photoOf('uid-attacker')))
    await assertFails(deleteObject(photoOf(null)))
    await assertSucceeds(deleteObject(photoOf(OWNER_UID)))
    await assertSucceeds(deleteObject(metadataOf()))
  })
})

describe('organization service objects remain server-only', () => {
  it.each(['owner', 'other', 'anonymous'])(
    'denies direct catalog and ledger reads/writes for %s',
    async (actor) => {
      const paths = [
        'organizations/catalog.json',
        'organization-permissions/owner/ledger.json',
      ]
      await testEnv.withSecurityRulesDisabled(async (context) => {
        for (const objectPath of paths)
          await uploadBytes(
            ref(context.storage(BUCKET_URL), objectPath),
            SMALL_JSON,
            JSON_TYPE,
          )
      })
      const context =
        actor === 'anonymous'
          ? testEnv.unauthenticatedContext()
          : testEnv.authenticatedContext(actor)
      for (const objectPath of paths) {
        const object = ref(context.storage(BUCKET_URL), objectPath)
        await assertFails(getMetadata(object))
        await assertFails(uploadBytes(object, SMALL_JSON, JSON_TYPE))
        await assertFails(deleteObject(object))
      }
    },
  )
})
