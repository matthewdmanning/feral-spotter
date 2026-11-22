/**
 * #486 end to end on the Auth and Storage emulators: a real ID token, the
 * real storage.rules, the real admission handler and Admin SDK adapters.
 * What the unit tests cannot show: the claim the handler writes reaches a
 * refreshed token, and the deployed rules accept exactly what it grants.
 *
 * The Storage emulator ignores `ifGenerationMatch`; ledger serialization
 * is covered by uploads/__tests__/adaptersConcurrency.test.ts.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deleteApp, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'
import {
  createUploadAdmissionPorts,
  deleteLateErasedUpload,
  retireUploadIdentity,
} from '../adapters'
import type { PersonLedger } from '../admission'
import { UPLOAD_QUOTA_ROOT } from '../../submissionLayout'
import { handleAdmitPhotoUpload } from '../admission'

let app: App
let authOrigin: string
let storageOrigin: string
let bucketName: string
const uid = `uid-admission-${process.pid}-${Date.now()}`
const submissionId = 'sub-e2e'

/** Fails before any request if a live endpoint could be used. */
function requireLoopback(name: string): string {
  const value = process.env[name]
  const url = value
    ? new URL(value.includes('://') ? value : `http://${value}`)
    : null
  if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error(`${name} must point to a local emulator`)
  return url.origin
}

/** A fresh ID token, carrying the uid's current custom claims. */
async function idToken(forUid = uid): Promise<string> {
  const response = await fetch(
    `${authOrigin}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator-only`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: await getAuth().createCustomToken(forUid),
        returnSecureToken: true,
      }),
    },
  )
  if (!response.ok) throw new Error('Emulator sign-in failed')
  return ((await response.json()) as { idToken: string }).idToken
}

/** A client write through storage.rules, as the app's SDK makes it. */
async function clientUpload(
  token: string,
  fileName: string,
  contentType: string,
): Promise<number> {
  const name = encodeURIComponent(
    `submissions/${uid}/${submissionId}/${fileName}`,
  )
  const response = await fetch(
    `${storageOrigin}/v0/b/${bucketName}/o?name=${name}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Firebase ${token}`,
        'Content-Type': contentType,
      },
      body: new Uint8Array([1, 2, 3]),
    },
  )
  return response.status
}

const admitRequest = async (body: unknown, forUid = uid) =>
  handleAdmitPhotoUpload(
    { authorization: `Bearer ${await idToken(forUid)}`, body },
    createUploadAdmissionPorts(bucketName, () => 'emulator-only-key'),
  )

beforeAll(async () => {
  authOrigin = requireLoopback('FIREBASE_AUTH_EMULATOR_HOST')
  storageOrigin = requireLoopback('FIREBASE_STORAGE_EMULATOR_HOST')
  const projectId = process.env.GCLOUD_PROJECT
  if (!projectId) throw new Error('Run through the repository emulator runner')
  bucketName = `${projectId}.firebasestorage.app`
  app = initializeApp({ projectId, storageBucket: bucketName })
  // Load the repository's rules, as @firebase/rules-unit-testing does.
  const rules = await fetch(`${storageOrigin}/internal/setRules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rules: {
        files: [
          {
            name: 'storage.rules',
            content: readFileSync(
              resolve(__dirname, '../../../../storage.rules'),
              'utf8',
            ),
          },
        ],
      },
    }),
  })
  if (!rules.ok)
    throw new Error(`Loading storage.rules failed: ${rules.status}`)
  await getAuth().createUser({ uid })
})

afterAll(async () => {
  await getAuth()
    .deleteUser(uid)
    .catch(() => {})
  await deleteApp(app)
})

test('a grant reaches a refreshed token and opens exactly the granted names', async () => {
  expect(await clientUpload(await idToken(), 'photo-0.jpg', 'image/heic')).toBe(
    403,
  )

  const admitted = await admitRequest({ submissionId, slot: 0, raw: false })
  expect(admitted.status).toBe(200)

  const token = await idToken()
  expect(await clientUpload(token, 'photo-0.jpg', 'image/heic')).toBe(200)
  expect(await clientUpload(token, 'photo-0.dng', 'image/x-adobe-dng')).toBe(
    403,
  )
  expect(await clientUpload(token, 'photo-1.jpg', 'image/jpeg')).toBe(403)
  expect(await clientUpload(token, 'metadata.json', 'application/json')).toBe(
    403,
  )

  expect((await admitRequest({ submissionId, metadata: true })).status).toBe(
    200,
  )
  expect(
    await clientUpload(await idToken(), 'metadata.json', 'application/json'),
  ).toBe(200)
})

test('stored objects count against the next admission', async () => {
  const ports = createUploadAdmissionPorts(
    bucketName,
    () => 'emulator-only-key',
  )
  const stored = await ports.listStored([uid])
  expect(stored.get(`submissions/${uid}/${submissionId}/photo-0.jpg`)).toBe(3)
})

test('erasing the account and signing up again with the same email keeps the count', async () => {
  const email = `admission-${process.pid}-${Date.now()}@example.test`
  const first = `${uid}-first`
  const second = `${uid}-second`
  await getAuth().createUser({ uid: first, email })
  const metadata = { submissionId: 'sub-erased', metadata: true }
  expect(await admitRequest(metadata, first)).toEqual({
    status: 403,
    body: { error: 'email_verification_required' },
  })
  await getAuth().updateUser(first, { emailVerified: true })
  expect((await admitRequest(metadata, first)).status).toBe(200)

  // The erasure pipeline's upload steps, then the Auth user.
  await retireUploadIdentity(bucketName, first, true)
  await getStorage()
    .bucket(bucketName)
    .deleteFiles({ prefix: `submissions/${first}/` })
  await getAuth().deleteUser(first)

  const lateObject = getStorage()
    .bucket(bucketName)
    .file(`submissions/${first}/sub-erased/metadata.json`)
  await lateObject.save('{}')
  const [lateMetadata] = await lateObject.getMetadata()
  expect(
    await deleteLateErasedUpload(
      bucketName,
      lateObject.name,
      Number(lateMetadata.generation),
    ),
  ).toBe(true)
  expect(await lateObject.exists()).toEqual([false])

  await getAuth().createUser({ uid: second, email, emailVerified: true })
  expect((await admitRequest(metadata, second)).status).toBe(200)

  const [files] = await getStorage()
    .bucket(bucketName)
    .getFiles({ prefix: `${UPLOAD_QUOTA_ROOT}persons/` })
  const people = await Promise.all(
    files.map(
      async (file) =>
        JSON.parse((await file.download())[0].toString()) as PersonLedger,
    ),
  )
  expect(people.filter((p) => p.uids.includes(second))).toEqual([
    expect.objectContaining({
      uids: [first, second],
      submissions: [`${second}/sub-erased`],
      retiredSubmissions: 1,
    }),
  ])
  await getAuth().deleteUser(second)
})
