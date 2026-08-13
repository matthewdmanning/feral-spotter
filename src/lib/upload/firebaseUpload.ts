/**
 * Uploads a submission photo directly to Cloud Storage via
 * @react-native-firebase/storage's putFile (resumable, survives spotty field
 * network — see docs/adr/0005-firebase-storage-for-uploads.md).
 *
 * Object path: submissions/{uid}/{submissionId}/{fileName} — must match
 * storage.rules and the Firestore counter functions/src/index.ts maintains.
 */
import { getApp } from '@react-native-firebase/app'
import {
  getDownloadURL,
  getStorage,
  putFile,
  ref,
} from '@react-native-firebase/storage'
import type { PhotoUploadResponse, SubmissionPhoto } from '@/src/types'

const BUCKET_URL = 'gs://feral-spotter-image-uploads'

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
  const storage = getStorage(getApp(), BUCKET_URL)
  const objectPath = `submissions/${uid}/${submissionId}/${photo.local_id}.${extensionFromUri(photo.uri)}`
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
