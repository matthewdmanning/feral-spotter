/**
 * Uploads a submission photo directly to Cloud Storage via
 * @react-native-firebase/storage's putFile (resumable, survives spotty field
 * network — see docs/adr/0005-firebase-storage-for-uploads.md).
 *
 * Object path: submissions/{uidHash}/{submissionId}/{fileName} — uidHash is
 * hashUid(uid) below, must match storage.rules and firestore.rules, which
 * recompute the same hash rather than trusting a path segment as identity.
 */
import { getApp } from '@react-native-firebase/app'
import {
  getDownloadURL,
  getMetadata,
  getStorage,
  putFile,
  ref,
  updateMetadata,
  uploadString,
} from '@react-native-firebase/storage'
import { USER_ID_HASH_SALT, UPLOADS_MOCK } from '@/src/config/constants'
import type {
  PhotoUploadResponse,
  SubmissionApiPayload,
  SubmissionPhoto,
} from '@/src/types'
import {
  CryptoDigestAlgorithm,
  CryptoEncoding,
  digestStringAsync,
} from 'expo-crypto'

const BUCKET_URL = 'gs://feral-spotter-image-uploads'

function extensionFromUri(uri: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(uri)
  return match ? match[1].toLowerCase() : 'jpg'
}

/**
 * Salted SHA-256 of a Firebase Auth uid — the single source of truth for
 * both the Storage object path's owner segment and the `user_id_hash`
 * customMetadata field, so the two are identical by construction rather
 * than by two call sites happening to agree. storage.rules/firestore.rules
 * recompute this same value from request.auth.uid via the rules language's
 * own hashing.sha256(), so the raw uid never has to be trusted from a path
 * segment or a client-supplied field.
 */
export async function hashUid(uid: string): Promise<string> {
  return digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    USER_ID_HASH_SALT + uid,
    // Pinned rather than relying on the documented HEX default — rules
    // recompute this value independently via hashing.sha256().toHexString(),
    // so a version bump silently flipping the default would 403 every
    // upload without a client-side error to point at.
    { encoding: CryptoEncoding.HEX },
  )
}

export async function uploadSubmissionPhoto(
  photo: SubmissionPhoto,
  uid: string,
  submissionId: string,
  onProgress?: (percent: number) => void,
): Promise<PhotoUploadResponse> {
  const storage = getStorage(getApp(), BUCKET_URL)
  const uidHash = await hashUid(uid)
  const objectPath = `submissions/${uidHash}/${submissionId}/${photo.local_id}.${extensionFromUri(photo.uri)}`
  const reference = ref(storage, objectPath)

  const task = putFile(reference, photo.uri)
  if (onProgress) {
    task.on('state_changed', (snapshot) => {
      onProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
    })
  }
  await task

  const cloud_storage_url = await getDownloadURL(reference)
  return { cloud_storage_path: objectPath, cloud_storage_url }
}

/**
 * Uploads the final submission's cats/metadata/photo-paths as
 * submissions/{uid}/{submissionId}/metadata.json — same bucket and object
 * path convention as the photos, so a submission is one self-contained
 * folder in Cloud Storage rather than split across Storage and a separate
 * backend. See storage.rules for the matching write rule.
 *
 * UPLOADS_MOCK short-circuits this for test drives with no real Firebase
 * project access — must be set explicitly (EXPO_PUBLIC_UPLOADS_MOCK=true),
 * never inferred from __DEV__.
 */
export async function uploadSubmissionMetadata(
  payload: SubmissionApiPayload,
  uid: string,
  submissionId: string,
): Promise<void> {
  if (UPLOADS_MOCK) return

  const storage = getStorage(getApp(), BUCKET_URL)
  const uidHash = await hashUid(uid)
  const objectPath = `submissions/${uidHash}/${submissionId}/metadata.json`
  const reference = ref(storage, objectPath)

  await uploadString(reference, JSON.stringify(payload), 'raw', {
    contentType: 'application/json',
  })
}

/**
 * Backfills a photo's Storage object with the submission's finalized
 * location/time, its own upload time, and a hashed user id — set at Submit,
 * once those values are settled, not at initial upload. Images are consumed
 * separately from metadata.json downstream (ML pipeline export), so each
 * object must be self-describing on its own (#264 amendment to
 * ADR-0002/ADR-0003).
 *
 * upload_time is read back from the object's own `timeCreated` (the actual
 * moment the bytes landed, set by Storage itself) rather than "now" — this
 * runs at Submit, which can be well after the photo actually uploaded.
 */
export async function finalizeSubmissionPhotoMetadata(
  objectPath: string,
  userIdHash: string,
  photoTime: string,
  latitude?: number,
  longitude?: number,
): Promise<void> {
  if (UPLOADS_MOCK) return

  const storage = getStorage(getApp(), BUCKET_URL)
  const reference = ref(storage, objectPath)

  const existing = await getMetadata(reference)

  await updateMetadata(reference, {
    customMetadata: {
      ...existing.customMetadata,
      photo_time: photoTime,
      upload_time: existing.timeCreated,
      user_id_hash: userIdHash,
      ...(latitude != null &&
        longitude != null && {
          location_lat: String(latitude),
          location_lng: String(longitude),
        }),
    },
  })
}
