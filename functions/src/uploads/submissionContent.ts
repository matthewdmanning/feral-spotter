import sharp from 'sharp'
import {
  isStoredPhotoFileName,
  MAX_METADATA_BYTES,
  MAX_PHOTO_BYTES,
  submissionPrefix,
} from '../submissionLayout'

function isRecord(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Reads the fields shared by both the current and older Submission payloads. */
export function parseSubmissionMetadata(
  bytes: Buffer,
  uid: string,
  submissionId: string,
) {
  if (bytes.length >= MAX_METADATA_BYTES) return null
  const prefix = submissionPrefix(uid, submissionId)
  let metadata: {
    submission: {
      latitude?: number
      longitude?: number
      report_injured?: boolean
    }
    cats: Record<string, unknown>[]
    photo_paths: string[]
    photo_pairs?: { jpeg_path: string; dng_path: string }[]
  }
  try {
    metadata = JSON.parse(bytes.toString())
  } catch (error) {
    if (error instanceof SyntaxError) return null
    throw error
  }
  if (!isRecord(metadata) || !isRecord(metadata.submission)) return null
  /** Use this function to reject metadata paths outside the owning Submission. */
  const pathInSubmission = (value: unknown): value is string => {
    if (typeof value !== 'string' || !value.startsWith(prefix)) return false
    const fileName = value.slice(prefix.length)
    return (
      fileName.length > 0 &&
      !fileName.includes('/') &&
      fileName !== 'metadata.json'
    )
  }
  /** Use this function to admit only supported artifact names in a pair. */
  const pairedPathInSubmission = (value: unknown): value is string =>
    pathInSubmission(value) && isStoredPhotoFileName(value.slice(prefix.length))
  const validPhotoPaths =
    Array.isArray(metadata.photo_paths) &&
    metadata.photo_paths.every((path) => pathInSubmission(path))
  const pairJpegs = new Set<string>()
  const pairDngs = new Set<string>()
  const validPhotoPairs =
    metadata.photo_pairs == null ||
    (validPhotoPaths &&
      Array.isArray(metadata.photo_pairs) &&
      metadata.photo_pairs.every((pair) => {
        if (
          pair == null ||
          !pairedPathInSubmission(pair.jpeg_path) ||
          !pairedPathInSubmission(pair.dng_path) ||
          pair.jpeg_path.endsWith('.dng') ||
          !pair.dng_path.endsWith('.dng') ||
          !metadata.photo_paths.includes(pair.jpeg_path)
        )
          return false
        const jpegSlot = pair.jpeg_path
          .slice(prefix.length)
          .replace(/\.[^.]+$/, '')
        const dngSlot = pair.dng_path
          .slice(prefix.length)
          .replace(/\.[^.]+$/, '')
        if (
          jpegSlot !== dngSlot ||
          pairJpegs.has(pair.jpeg_path) ||
          pairDngs.has(pair.dng_path)
        )
          return false
        pairJpegs.add(pair.jpeg_path)
        pairDngs.add(pair.dng_path)
        return true
      }))
  if (
    !Array.isArray(metadata.cats) ||
    metadata.cats.length < 1 ||
    !metadata.cats.every(isRecord) ||
    !Array.isArray(metadata.photo_paths) ||
    !validPhotoPaths ||
    !validPhotoPairs
  )
    return null
  return metadata
}

/** Decodes the image and checks its actual format before trusting a JPEG upload. */
export async function isValidJpeg(bytes: Buffer): Promise<boolean> {
  if (bytes.length >= MAX_PHOTO_BYTES) return false
  try {
    const image = sharp(bytes, { failOn: 'warning' })
    if ((await image.metadata()).format !== 'jpeg') return false
    await image.resize(1, 1).toBuffer()
    return true
  } catch {
    return false
  }
}
