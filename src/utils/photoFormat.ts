/**
 * utils/photoFormat.ts
 * The photo formats a Submission accepts. storage.rules allows exactly these
 * (photo-N.jpg|jpeg|png|heic|heif, image/jpeg|png|heic|heif); a photo in
 * any other format would be refused on upload and sit un-uploaded.
 */

export const UPLOAD_PHOTO_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'heic',
  'heif',
] as const

const UPLOAD_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
]

/** Lower-case extension of a uri or file name, or undefined if it has none. */
export function extensionOf(name: string): string | undefined {
  return /\.([a-zA-Z0-9]+)$/.exec(name)?.[1].toLowerCase()
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
  return (
    ext === undefined ||
    (UPLOAD_PHOTO_EXTENSIONS as readonly string[]).includes(ext)
  )
}
