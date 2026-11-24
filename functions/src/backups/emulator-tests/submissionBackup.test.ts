import { deleteApp, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import sharp from 'sharp'
import { uidKey } from '../../submissionLayout'
import { backupSubmission, eraseSubmissionBackups } from '../submissionBackup'

const uid = `backup-${process.pid}-${Date.now()}`
const prefix = `submissions/${uid}/sighting/`
const backupPrefix = `submission-backups/${uidKey(uid)}/`
const metadataPath = `${prefix}metadata.json`
const photoPath = `${prefix}photo-0.jpg`
const primaryBucket = 'demo-feral-primary.appspot.com'
const backupBucket = 'demo-feral-backup.appspot.com'
let app: App

beforeAll(() => {
  for (const host of [
    process.env.FIRESTORE_EMULATOR_HOST,
    process.env.FIREBASE_STORAGE_EMULATOR_HOST,
  ]) {
    if (
      !host ||
      !/^(https?:\/\/)?(localhost|127[.]0[.]0[.]1):[0-9]+$/.test(host)
    )
      throw new Error(
        'This test requires local Storage and Firestore emulators',
      )
  }
  app = initializeApp({ projectId: 'demo-feral-spotter' })
})

afterAll(async () => {
  if (!app) return
  await getStorage().bucket(primaryBucket).deleteFiles({ prefix })
  await getStorage().bucket(backupBucket).deleteFiles({ prefix: backupPrefix })
  await getFirestore().recursiveDelete(
    getFirestore().collection('submissionBackupAccounts').doc(uidKey(uid)),
  )
  await deleteApp(app)
})

it('backs up one crop and the full payload, replaces a prior generation, and fences erased accounts', async () => {
  const primary = getStorage().bucket(primaryBucket)
  const destination = getStorage().bucket(backupBucket)
  const owner = getFirestore()
    .collection('submissionBackupAccounts')
    .doc(uidKey(uid))
  const record = owner.collection('submissionBackups').doc('sighting')
  const jpeg = await sharp({
    create: { width: 40, height: 30, channels: 3, background: 'red' },
  })
    .jpeg()
    .toBuffer()
  await primary
    .file(photoPath)
    .save(jpeg, { resumable: false, contentType: 'image/jpeg' })
  const payload = {
    submission: {
      latitude: 35,
      longitude: -80,
      manual_time: '2026-11-24T10:00:00Z',
    },
    cats: [
      {
        color: 'red',
        boxes: [
          {
            cloud_storage_path: photoPath,
            lowerLeftX: 0.25,
            upperRightY: 0.2,
            upperRightX: 0.75,
            lowerLeftY: 0.8,
          },
        ],
      },
    ],
    photo_paths: [photoPath],
  }
  const putMetadata = async (json: string) => {
    const file = primary.file(metadataPath)
    await file.save(json, { resumable: false, contentType: 'application/json' })
    const [info] = await file.getMetadata()
    return {
      name: metadataPath,
      generation: Number(info.generation),
      size: Buffer.byteLength(json),
    }
  }

  const metadataJson = JSON.stringify(payload)
  const first = await putMetadata(metadataJson)
  await backupSubmission(primaryBucket, backupBucket, first)
  await backupSubmission(primaryBucket, backupBucket, first)
  const imagePath = `${backupPrefix}sighting/${first.generation}.jpg`
  expect((await record.get()).data()).toMatchObject({
    metadataJson,
    image: { bucket: backupBucket, path: imagePath },
  })
  const [crop] = await destination.file(imagePath).download()
  expect(await sharp(crop).metadata()).toMatchObject({ width: 20, height: 18 })

  const nextJson = JSON.stringify({
    ...payload,
    cats: [{ color: 'red' }],
    photo_paths: [],
  })
  const next = await putMetadata(nextJson)
  await backupSubmission(primaryBucket, backupBucket, next)
  expect((await record.get()).data()).toMatchObject({
    metadataJson: nextJson,
    image: null,
  })
  expect(await destination.file(imagePath).exists()).toEqual([false])

  const latest = await putMetadata(metadataJson)
  await backupSubmission(primaryBucket, backupBucket, latest)
  const latestImage = destination.file(
    `${backupPrefix}sighting/${latest.generation}.jpg`,
  )
  expect(await latestImage.exists()).toEqual([true])

  await eraseSubmissionBackups(backupBucket, uid)
  await backupSubmission(primaryBucket, backupBucket, latest)
  expect((await record.get()).exists).toBe(false)
  expect(await latestImage.exists()).toEqual([false])
  expect((await owner.get()).data()).toEqual({ erasing: true })
  expect((await primary.file(metadataPath).exists())[0]).toBe(true)
})
