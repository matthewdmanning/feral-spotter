import sharp from 'sharp'
import { isStoredPhotoFileName, MAX_PHOTO_BYTES } from '../submissionLayout'

interface PhotoCrop {
  path: string
  left: number
  top: number
  right: number
  bottom: number
}

function isNormalized(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1
}

/** The inset bubble uses the first confirmed box for its cat. */
export function selectBackupCrop(
  cats: Record<string, unknown>[],
  photoPaths: string[],
): PhotoCrop | undefined {
  for (const cat of cats) {
    if (!Array.isArray(cat.boxes)) continue
    const box = cat.boxes[0]
    if (!box) continue
    const path: unknown = box.cloud_storage_path
    const bounds: unknown[] = [
      box.lowerLeftX,
      box.upperRightY,
      box.upperRightX,
      box.lowerLeftY,
    ]
    if (
      typeof path !== 'string' ||
      !photoPaths.includes(path) ||
      !isStoredPhotoFileName(path.slice(path.lastIndexOf('/') + 1)) ||
      path.endsWith('.dng') ||
      !bounds.every(isNormalized)
    )
      continue
    const [left, top, right, bottom] = bounds
    if (right > left && bottom > top) return { path, left, top, right, bottom }
  }
}

const photoFormats: Readonly<Record<string, string | undefined>> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/heic': 'heif',
  'image/heif': 'heif',
}

/** Crop the displayed pixel orientation and strip all source metadata. */
export async function renderBackupJpeg(
  bytes: Buffer,
  contentType: string,
  crop: PhotoCrop,
): Promise<Buffer | undefined> {
  const format = photoFormats[contentType]
  if (!format || bytes.length >= MAX_PHOTO_BYTES) return
  try {
    const photo = sharp(bytes, { failOn: 'warning' })
    const info = await photo.metadata()
    if (info.format !== format) return

    const { width, height } = info.autoOrient
    const left = Math.floor(crop.left * width)
    const top = Math.floor(crop.top * height)
    return await photo
      .autoOrient()
      .extract({
        left,
        top,
        width: Math.ceil(crop.right * width) - left,
        height: Math.ceil(crop.bottom * height) - top,
      })
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 80 })
      .toBuffer()
  } catch {
    // A damaged or unsupported photo still has recoverable Submission data.
    return undefined
  }
}
