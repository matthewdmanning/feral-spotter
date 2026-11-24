/**
 * utils/photoFormat.ts
 * The photo formats a Submission accepts. storage.rules allows exactly these
 * types (image/jpeg|png|heic|heif, stored as photo-N.jpg, #487); a photo in
 * any other format would be refused on upload and sit un-uploaded.
 */

/** Accepted extension → the contentType it uploads with. The one list. */
export const PHOTO_FORMATS = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
} as const

type PhotoExtension = keyof typeof PHOTO_FORMATS

export const UPLOAD_PHOTO_EXTENSIONS = Object.keys(
  PHOTO_FORMATS,
) as PhotoExtension[]

const UPLOAD_PHOTO_MIME_TYPES: readonly string[] = Object.values(PHOTO_FORMATS)

const isPhotoExtension = (ext: string | undefined): ext is PhotoExtension =>
  ext !== undefined && ext in PHOTO_FORMATS

/** Lower-case extension of a uri or file name, or undefined if it has none. */
export function extensionOf(name: string): string | undefined {
  return /\.([a-zA-Z0-9]+)$/.exec(name)?.[1].toLowerCase()
}

/**
 * The Storage contentType for a JPEG-family photo path. Camera captures and
 * unrecognised names are JPEG.
 */
export function photoContentType(uri: string): string {
  const ext = extensionOf(uri)
  return isPhotoExtension(ext) ? PHOTO_FORMATS[ext] : PHOTO_FORMATS.jpg
}

/**
 * Whether a picked file is in an accepted format. Trusts the picker's mime
 * type when it reports one, else the file name's extension. A file with
 * neither is accepted: camera captures are JPEG and carry no name.
 */
export function isUploadablePhoto(file: {
  uri: string
  mimeType?: string | null
  fileName?: string | null
}): boolean {
  if (file.mimeType) {
    return UPLOAD_PHOTO_MIME_TYPES.includes(file.mimeType.toLowerCase())
  }
  const ext = extensionOf(file.fileName ?? file.uri)
  return ext === undefined || isPhotoExtension(ext)
}
