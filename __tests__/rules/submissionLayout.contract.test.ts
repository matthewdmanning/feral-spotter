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
} from '@/src/shared/config/submissionLimits'
import {
  METADATA_FILE_NAME as APP_METADATA,
  metadataObjectPath,
  photoObjectPath,
  submissionPrefix as appSubmissionPrefix,
} from '@/src/features/draft-submission/lib/upload/submissionLayout'
import { UPLOAD_PHOTO_EXTENSIONS } from '@/src/shared/utils/photoFormat'
import {
  MAX_SUBMISSIONS_PER_UID as SERVER_MAX_SUBMISSIONS,
  METADATA_FILE_NAME as SERVER_METADATA,
  SUBMISSION_CAP_CLAIM,
  parseSubmissionObject,
  submissionPrefix as serverSubmissionPrefix,
} from '@/functions/src/submissionLayout'

/**
 * The Submission storage contract has three copies: the app's layout
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

const write = (name: string, bytes: Uint8Array, contentType: string) =>
  uploadBytes(
    ref(testEnv.authenticatedContext(UID).storage(BUCKET_URL), name),
    bytes,
    { contentType },
  )

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
}

it('app and functions agree on the shared names and numbers', () => {
  expect(APP_METADATA).toBe(SERVER_METADATA)
  expect(APP_MAX_SUBMISSIONS).toBe(SERVER_MAX_SUBMISSIONS)
  expect(appSubmissionPrefix(UID, SUB)).toBe(serverSubmissionPrefix(UID, SUB))
  expect(SUBMISSION_CAP_CLAIM).toBe('submissionCapReached')
  expect(
    fs.readFileSync(path.resolve(__dirname, '../../storage.rules'), 'utf8'),
  ).toContain(`'${SUBMISSION_CAP_CLAIM}'`)
})

it('every slot the app can name is a photo the rules accept and functions parse', async () => {
  for (let slot = 0; slot < MAX_PHOTOS; slot += 1) {
    const name = photoObjectPath(UID, SUB, slot, `file:///p${slot}.jpg`)
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
  expect(() => photoObjectPath(UID, SUB, MAX_PHOTOS, 'file:///x.jpg')).toThrow()
  await assertFails(
    write(
      `${appSubmissionPrefix(UID, SUB)}photo-${MAX_PHOTOS}.jpg`,
      new Uint8Array([1]),
      'image/jpeg',
    ),
  )
})

it('every accepted format is one the rules accept', async () => {
  for (const ext of UPLOAD_PHOTO_EXTENSIONS) {
    const name = photoObjectPath(UID, `${SUB}-fmt`, 0, `file:///p.${ext}`)
    await assertSucceeds(write(name, new Uint8Array([1]), MIME[ext]))
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
