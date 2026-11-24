import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import type { StorageObjectData } from 'firebase-functions/v2/storage'
import { validId } from '../organizations/domain'
import {
  MAX_METADATA_BYTES,
  MAX_PHOTO_BYTES,
  parseSubmissionObject,
  uidKey,
} from '../submissionLayout'
import { parseSubmissionMetadata } from '../uploads/submissionContent'
import { renderBackupJpeg, selectBackupCrop } from './crop'

const code = (error: unknown) => (error as { code?: unknown } | null)?.code
const backupPrefix = (uid: string) => `submission-backups/${uidKey(uid)}/`
const account = (uid: string) =>
  getFirestore().collection('submissionBackupAccounts').doc(uidKey(uid))

export async function backupSubmission(
  sourceBucket: string,
  backupBucket: string,
  data: Pick<StorageObjectData, 'name' | 'generation' | 'size'>,
): Promise<void> {
  const object = parseSubmissionObject(data.name)
  if (
    !object?.isMetadata ||
    !validId(object.submissionId) ||
    data.size >= MAX_METADATA_BYTES
  )
    return
  if (sourceBucket === backupBucket)
    throw new Error('Submission backups require a separate bucket')

  const db = getFirestore()
  const owner = account(object.uid)
  const destination = getStorage().bucket(backupBucket)
  const document = owner
    .collection('submissionBackups')
    .doc(object.submissionId)
  const prefix = `${backupPrefix(object.uid)}${object.submissionId}/`
  const generation = String(data.generation)
  const imagePath = `${prefix}${generation}.jpg`
  const image = destination.file(imagePath)
  if ((await owner.get()).get('erasing') === true) {
    await image.delete({ ignoreNotFound: true })
    return
  }

  const source = getStorage().bucket(sourceBucket)
  const metadataFile = source.file(data.name, { generation })
  let bytes: Buffer
  try {
    ;[bytes] = await metadataFile.download()
  } catch (error) {
    if (code(error) === 404) return
    throw error
  }
  const metadata = parseSubmissionMetadata(
    bytes,
    object.uid,
    object.submissionId,
  )
  if (!metadata) return

  const crop = selectBackupCrop(metadata.cats, metadata.photo_paths)
  let jpeg: Buffer | undefined
  if (crop) {
    try {
      const [info] = await source.file(crop.path).getMetadata()
      if (
        Number(info.size) < MAX_PHOTO_BYTES &&
        info.generation &&
        info.contentType
      ) {
        const [photo] = await source
          .file(crop.path, { generation: info.generation })
          .download()
        jpeg = await renderBackupJpeg(photo, info.contentType, crop)
      }
    } catch (error) {
      if (code(error) !== 404) throw error
    }
  }

  if (jpeg) {
    try {
      await image.save(jpeg, {
        resumable: false,
        contentType: 'image/jpeg',
        metadata: { cacheControl: 'private, no-store' },
        preconditionOpts: { ifGenerationMatch: 0 },
      })
    } catch (error) {
      if (code(error) !== 412) throw error
    }
  }
  // A previous delivery can have saved this image and failed before writing
  // Firestore, even if a later delivery can no longer read the source photo.
  const hasImage = jpeg != null || (await image.exists())[0]

  const keep = await db.runTransaction(async (transaction) => {
    if ((await transaction.get(owner)).get('erasing') === true) return false
    const saved = await transaction.get(document)
    const previous = saved.get('sourceGeneration') as string | undefined
    if (previous && BigInt(previous) > BigInt(generation)) return false
    if (previous === generation && (!hasImage || saved.get('image')))
      return true

    transaction.set(document, {
      sourceGeneration: generation,
      metadataJson: bytes.toString('utf8'),
      image: hasImage ? { bucket: backupBucket, path: imagePath } : null,
    })
    return true
  })

  if (!keep) {
    // Account deletion or a newer retry won the transaction. This path
    // identifies only this event's generation.
    await image.delete({ ignoreNotFound: true })
    return
  }

  const [images] = await destination.getFiles({ prefix })
  await Promise.all(
    images.map(async (file) => {
      const version = /^([0-9]+)[.]jpg$/.exec(file.name.slice(prefix.length))
      if (version && BigInt(version[1]) < BigInt(generation))
        await file.delete({ ignoreNotFound: true })
    }),
  )
}

export async function eraseSubmissionBackups(
  bucketName: string,
  uid: string,
): Promise<void> {
  const owner = account(uid)
  // Keep this data-free marker so late events cannot recreate backups.
  await owner.set({ erasing: true })
  await getStorage()
    .bucket(bucketName)
    .deleteFiles({ prefix: backupPrefix(uid) })
  await getFirestore().recursiveDelete(owner.collection('submissionBackups'))
}
