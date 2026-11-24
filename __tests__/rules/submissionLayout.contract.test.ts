import * as fs from 'fs'
import * as path from 'path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { ref, uploadBytes } from 'firebase/storage'
import {
  MAX_PHOTOS,
  MAX_SUBMISSIONS_PER_UID as APP_MAX_SUBMISSIONS,
  STORAGE_BUCKET_NAME as APP_BUCKET,
} from '@/src/shared/config/submissionLimits'
import {
  METADATA_FILE_NAME as APP_METADATA,
  metadataObjectPath,
  photoObjectPath,
  rawPhotoObjectPath,
  submissionPrefix as appSubmissionPrefix,
} from '@/src/features/draft-submission/lib/upload/submissionLayout'
import {
  UPLOAD_PHOTO_EXTENSIONS,
  photoContentType,
} from '@/src/shared/utils/photoFormat'
import {
  DEFAULT_BUCKET_NAME as SERVER_BUCKET,
  MAX_SUBMISSIONS_PER_UID as SERVER_MAX_SUBMISSIONS,
  METADATA_FILE_NAME as SERVER_METADATA,
  MAX_PHOTO_BYTES,
  MAX_RAW_PHOTO_BYTES,
  SUBMISSION_CAP_CLAIM,
  UPLOAD_GRANTS_CLAIM,
  grantToken,
  isSubmissionPhotoFileName,
  parseSubmissionObject,
  photoFileName,
  rawPhotoFileName,
  submissionPrefix as serverSubmissionPrefix,
} from '@/functions/src/submissionLayout'

/**
 * The sighting storage contract has three copies: the app's layout
 * module, functions/' layout module and storage.rules. Each used to be
 * kept in step by hand, and two drifted (#396's bucket, a stale rules
 * reference). This pins them: every path the app can write is one the
 * rules accept and functions/ parses, and the shared numbers agree.
 */

const PROJECT_ID = 'demo-feral-spotter'
const BUCKET_URL = `gs://${PROJECT_ID}.appspot.com`
const UID = 'uid-contract'
const SUB = 'sub-contract'

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
afterAll(() => testEnv.cleanup())

// The grant functions/ would issue for this name (#486).
const grantClaims = (name: string) => {
  const object = parseSubmissionObject(name)
  return object &&
    (object.isMetadata || isSubmissionPhotoFileName(object.fileName))
    ? {
        [UPLOAD_GRANTS_CLAIM]: {
          [object.submissionId]: {
            e: Date.now() + 60_000,
            f: [grantToken(object.fileName)],
          },
        },
      }
    : undefined
}

const write = (name: string, bytes: Uint8Array, contentType: string) =>
  uploadBytes(
    ref(
      testEnv.authenticatedContext(UID, grantClaims(name)).storage(BUCKET_URL),
      name,
    ),
    bytes,
    { contentType },
  )

it('app and functions agree on the shared names and numbers', () => {
  expect(APP_BUCKET).toBe(SERVER_BUCKET)
  expect(APP_METADATA).toBe(SERVER_METADATA)
  expect(APP_MAX_SUBMISSIONS).toBe(SERVER_MAX_SUBMISSIONS)
  expect(appSubmissionPrefix(UID, SUB)).toBe(serverSubmissionPrefix(UID, SUB))
  expect(SUBMISSION_CAP_CLAIM).toBe('submissionCapReached')
  expect(
    fs.readFileSync(path.resolve(__dirname, '../../storage.rules'), 'utf8'),
  ).toContain(`'${SUBMISSION_CAP_CLAIM}'`)
  const rules = fs.readFileSync(
    path.resolve(__dirname, '../../storage.rules'),
    'utf8',
  )
  expect(rules).toContain(`'${UPLOAD_GRANTS_CLAIM}'`)
  expect(rules).toContain(`${MAX_PHOTO_BYTES / 1024 / 1024} * 1024 * 1024`)
  expect(rules).toContain(`${MAX_RAW_PHOTO_BYTES / 1024 / 1024} * 1024 * 1024`)
})

it('every slot the app can name is a photo the rules accept and functions parse', async () => {
  for (let slot = 0; slot < MAX_PHOTOS; slot += 1) {
    const name = photoObjectPath(UID, SUB, slot)
    // #487: one JPEG-family name per slot, the one functions/ grants.
    expect(name).toBe(`${appSubmissionPrefix(UID, SUB)}${photoFileName(slot)}`)
    expect(rawPhotoObjectPath(UID, SUB, slot)).toBe(
      `${appSubmissionPrefix(UID, SUB)}${rawPhotoFileName(slot)}`,
    )
    expect(parseSubmissionObject(name)).toEqual(
      expect.objectContaining({
        uid: UID,
        submissionId: SUB,
        isMetadata: false,
      }),
    )
    await assertSucceeds(write(name, new Uint8Array([1]), 'image/jpeg'))
  }
  // The app cannot name an eleventh slot, and the rules refuse one anyway.
  expect(() => photoObjectPath(UID, SUB, MAX_PHOTOS)).toThrow()
  await assertFails(
    write(
      `${appSubmissionPrefix(UID, SUB)}photo-${MAX_PHOTOS}.jpg`,
      new Uint8Array([1]),
      'image/jpeg',
    ),
  )

  const dng = rawPhotoObjectPath(UID, SUB, 0)
  expect(parseSubmissionObject(dng)).toEqual(
    expect.objectContaining({ uid: UID, submissionId: SUB, isMetadata: false }),
  )
  await assertSucceeds(write(dng, new Uint8Array([1]), 'image/x-adobe-dng'))
})

it('every accepted format is one the rules accept under the slot name', async () => {
  for (const ext of UPLOAD_PHOTO_EXTENSIONS) {
    const name = photoObjectPath(UID, `${SUB}-fmt`, 0)
    // The type the app uploads this extension with, not a test-side copy.
    await assertSucceeds(
      write(name, new Uint8Array([1]), photoContentType(`photo.${ext}`)),
    )
  }
})

it('the metadata path is one the rules accept and functions parse as metadata', async () => {
  const name = metadataObjectPath(UID, SUB)
  expect(parseSubmissionObject(name)).toEqual(
    expect.objectContaining({ uid: UID, isMetadata: true }),
  )
  await assertSucceeds(
    write(name, new Uint8Array([0x7b, 0x7d]), 'application/json'),
  )
})
