/**
 * Uploads a submission photo directly to Cloud Storage via
 * @react-native-firebase/storage's putFile (resumable, survives spotty field
 * network — see docs/adr/0005-firebase-storage-for-uploads.md).
 *
 * Object path: submissions/{uid}/{submissionId}/{fileName} — uid is the
 * signed-in Firebase Auth uid directly. storage.rules/firestore.rules check
 * ownership by comparing this segment against request.auth.uid, so there's
 * no cross-language hash computation that the two sides need to agree on
 * (previously a salted SHA-256, dropped 2026-08-16 — product decision: a
 * Firebase Auth uid is already opaque/third-party-issued, hashing it added
 * no privacy benefit, and the raw uid helps locate a user's objects later.
 * See storage.rules for the full reasoning, including why the hash's
 * cross-language byte-for-byte match was never actually confirmed).
 */
import { getApp } from '@react-native-firebase/app'
import {
  connectStorageEmulator,
  getDownloadURL,
  getMetadata,
  getStorage,
  putFile,
  ref,
  updateMetadata,
  uploadString,
  type FirebaseStorage,
  type StorageReference,
} from '@react-native-firebase/storage'
import {
  FIREBASE_EMULATOR_HOST,
  STORAGE_EMULATOR_PORT,
  UPLOADS_MOCK,
  USE_FIREBASE_EMULATOR,
} from '@/src/config/constants'
import type {
  PhotoUploadResponse,
  SubmissionApiPayload,
  SubmissionPhoto,
} from '@/src/types'

const BUCKET_URL = 'gs://project-e3d5659d-bc4f-438f-88c.firebasestorage.app'

let storageInstance: FirebaseStorage | null = null

// One lazily-created, memoized Storage instance so the emulator connection
// (which errors if called more than once per instance) only ever happens
// once, regardless of how many of this file's functions run.
function getSubmissionRef(path: string): StorageReference {
  if (!storageInstance) {
    storageInstance = getStorage(getApp(), BUCKET_URL)
    if (USE_FIREBASE_EMULATOR) {
      connectStorageEmulator(
        storageInstance,
        FIREBASE_EMULATOR_HOST,
        STORAGE_EMULATOR_PORT,
      )
      // connectStorageEmulator never fails on its own — it just points the
      // SDK at this URL. If nothing's actually listening there, an upload
      // would only fail later with a generic network error. Ping it now so
      // a forgotten `firebase emulators:start` is loud and immediate
      // instead.
      const emulatorUrl = `http://${FIREBASE_EMULATOR_HOST}:${STORAGE_EMULATOR_PORT}`
      fetch(emulatorUrl).catch(() => {
        console.error(
          `[firebaseUpload] EXPO_PUBLIC_USE_FIREBASE_EMULATOR is set but the Storage emulator at ${FIREBASE_EMULATOR_HOST}:${STORAGE_EMULATOR_PORT} is unreachable. Run \`firebase emulators:start\` before test-driving in emulator mode.`,
        )
      })
    }
  }
  return ref(storageInstance, path)
}

function extensionFromUri(uri: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(uri)
  return match ? match[1].toLowerCase() : 'jpg'
}

export async function uploadSubmissionPhoto(
  photo: SubmissionPhoto,
  uid: string,
  submissionId: string,
  onProgress?: (percent: number) => void,
): Promise<PhotoUploadResponse> {
  const objectPath = `submissions/${uid}/${submissionId}/${photo.local_id}.${extensionFromUri(photo.uri)}`
  const reference = getSubmissionRef(objectPath)

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

  const objectPath = `submissions/${uid}/${submissionId}/metadata.json`
  const reference = getSubmissionRef(objectPath)

  await uploadString(reference, JSON.stringify(payload), 'raw', {
    contentType: 'application/json',
  })
}

/**
 * Backfills a photo's Storage object with the submission's finalized
 * location/time, its own upload time, and the owning user id — set at
 * Submit, once those values are settled, not at initial upload. Images are
 * consumed separately from metadata.json downstream (ML pipeline export),
 * so each object must be self-describing on its own (#264 amendment to
 * ADR-0002/ADR-0003).
 *
 * upload_time is read back from the object's own `timeCreated` (the actual
 * moment the bytes landed, set by Storage itself) rather than "now" — this
 * runs at Submit, which can be well after the photo actually uploaded.
 */
export async function finalizeSubmissionPhotoMetadata(
  objectPath: string,
  userId: string,
  photoTime: string,
  latitude?: number,
  longitude?: number,
): Promise<void> {
  if (UPLOADS_MOCK) return

  const reference = getSubmissionRef(objectPath)

  const existing = await getMetadata(reference)

  await updateMetadata(reference, {
    customMetadata: {
      ...existing.customMetadata,
      photo_time: photoTime,
      upload_time: existing.timeCreated,
      user_id: userId,
      ...(latitude != null &&
        longitude != null && {
          location_lat: String(latitude),
          location_lng: String(longitude),
        }),
    },
  })
}
