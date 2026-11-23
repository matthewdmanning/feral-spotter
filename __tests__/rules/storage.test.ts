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
const OVERSIZED_DNG = new Uint8Array(65 * 1024 * 1024) // over the 64MB DNG cap
const SMALL_JSON = new Uint8Array([0x7b, 0x7d]) // '{}'
const OVERSIZED_JSON = new Uint8Array(257 * 1024) // over the 256KB cap
const OWNER_UID = 'uid-owner'
const JPEG = { contentType: 'image/jpeg' }
const DNG = { contentType: 'image/x-adobe-dng' }
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
// #486: photo bytes need an upload grant. Tests that are not about grants
// hold one for every slot of their Submission.
const ALL_TOKENS = Array.from({ length: 10 }, (_, i) => [
  `${i}.jpg`,
  `${i}.dng`,
]).flat()
const grantFor = (sub: string, f = ALL_TOKENS, e = Date.now() + 60_000) => ({
  uploadGrants: { [sub]: { e, f } },
})
const photoOf = (
  uid: string | null,
  file = 'photo-0.jpg',
  sub = 'sub-1',
  claims: Record<string, unknown> | null = grantFor(sub),
) =>
  objectAt(uid, `submissions/${OWNER_UID}/${sub}/${file}`, claims ?? undefined)
// Holds a metadata grant unless `granted` is false (#486).
const metadataOf = (
  claims?: Record<string, unknown>,
  sub = 'sub-1',
  granted = true,
) =>
  objectAt(OWNER_UID, `submissions/${OWNER_UID}/${sub}/metadata.json`, {
    ...(granted ? grantFor(sub, ['metadata.json']) : {}),
    ...claims,
  })

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

  it('allows an owner DNG in the paired slot and rejects bad DNG writes', async () => {
    await assertSucceeds(
      uploadBytes(photoOf(OWNER_UID, 'photo-0.dng'), SMALL_IMAGE, DNG),
    )
    await assertFails(
      uploadBytes(photoOf(OWNER_UID, 'photo-1.dng'), SMALL_IMAGE, JPEG),
    )
    await assertFails(
      uploadBytes(photoOf(OWNER_UID, 'photo-2.dng'), OVERSIZED_DNG, DNG),
    )
    await assertFails(
      uploadBytes(photoOf('uid-attacker', 'photo-3.dng'), SMALL_IMAGE, DNG),
    )
    await assertFails(
      uploadBytes(photoOf(OWNER_UID, 'photo-10.dng'), SMALL_IMAGE, DNG),
    )
  })

  // The 10-photo cap is the object name: photo-0 … photo-9 only.
  it.each([
    ['photo-9.jpg', true],
    // #487: one JPEG-family name per slot; the type is the contentType.
    ['photo-0.heic', false],
    ['photo-0.jpeg', false],
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
      grantFor('sub-1'),
    )
    await assertSucceeds(uploadBytes(stranger, SMALL_IMAGE, JPEG))
  })
})

// #486: functions/' admitPhotoUpload is the only issuer of grants, after it
// counts the object against the uid's quota. Without one, no new bytes.
describe('storage.rules — upload grants', () => {
  const at = (
    claims: Record<string, unknown> | null,
    file = 'photo-0.jpg',
    sub = 'sub-1',
  ) => photoOf(OWNER_UID, file, sub, claims)

  it('refuses bytes without a live grant for that exact name', async () => {
    await assertFails(uploadBytes(at(null), SMALL_IMAGE, JPEG))
    await assertFails(
      uploadBytes(
        at(grantFor('sub-1', ['0.jpg'], Date.now() - 1)),
        SMALL_IMAGE,
        JPEG,
      ),
    )
    const jpegOnly = grantFor('sub-1', ['0.jpg'])
    await assertSucceeds(uploadBytes(at(jpegOnly), SMALL_IMAGE, JPEG))
    await assertFails(
      uploadBytes(at(jpegOnly, 'photo-0.dng'), SMALL_IMAGE, DNG),
    )
    await assertFails(
      uploadBytes(at(jpegOnly, 'photo-1.jpg'), SMALL_IMAGE, JPEG),
    )
    await assertFails(
      uploadBytes(at(jpegOnly, 'photo-0.jpg', 'sub-2'), SMALL_IMAGE, JPEG),
    )
    // A legacy extension is refused even if a token names it.
    await assertFails(
      uploadBytes(
        at(grantFor('sub-1', ['0.heic']), 'photo-0.heic'),
        SMALL_IMAGE,
        {
          contentType: 'image/heic',
        },
      ),
    )
  })

  it('stores a HEIC photo under the slot .jpg name with its real type (#487)', async () => {
    await assertSucceeds(
      uploadBytes(at(grantFor('sub-1')), SMALL_IMAGE, {
        contentType: 'image/heic',
      }),
    )
  })

  it('lets Submit patch customMetadata without a grant, but not change bytes', async () => {
    await assertSucceeds(uploadBytes(at(grantFor('sub-1')), SMALL_IMAGE, JPEG))
    await assertSucceeds(
      updateMetadata(at(null), {
        customMetadata: { photo_time: '2026-08-01T10:00:00.000Z' },
      }),
    )
    await assertFails(uploadBytes(at(null), new Uint8Array([9, 9]), JPEG))
  })

  it('keeps a photo stored before #487 patchable', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(
        ref(
          context.storage(BUCKET_URL),
          `submissions/${OWNER_UID}/sub-1/photo-0.heic`,
        ),
        SMALL_IMAGE,
        { contentType: 'image/heic' },
      )
    })
    await assertSucceeds(
      updateMetadata(at(null, 'photo-0.heic'), {
        customMetadata: { user_id: OWNER_UID },
      }),
    )
  })
})

describe('storage.rules — metadata.json', () => {
  it('refuses metadata.json without a grant, even under the cap (#486)', async () => {
    await assertFails(
      uploadBytes(metadataOf(undefined, 'sub-1', false), SMALL_JSON, JSON_TYPE),
    )
    await assertFails(
      uploadBytes(
        metadataOf(grantFor('sub-1', ['0.jpg'])),
        SMALL_JSON,
        JSON_TYPE,
      ),
    )
  })

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

describe('service objects remain server-only', () => {
  it.each(['owner', 'other', 'anonymous'])(
    'denies direct upload quota reads/writes for %s',
    async (actor) => {
      const paths = ['upload-quota/owner/ledger.json']
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
