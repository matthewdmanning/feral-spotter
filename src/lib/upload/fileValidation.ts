/**
 * File type/size validation for the upload API route.
 * Extension is derived from the validated MIME type, never trusted from the
 * client-supplied filename, so it can't be used to smuggle a path/extension.
 */

export const ALLOWED_MIME_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
} as const

export type AllowedMimeType = keyof typeof ALLOWED_MIME_TYPES

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20MB

export type FileValidationResult =
  | { ok: true; extension: string }
  | { ok: false; status: number; error: string }

export function validateUploadFile(file: { type: string; size: number }): FileValidationResult {
  const extension = ALLOWED_MIME_TYPES[file.type as AllowedMimeType]
  if (!extension) {
    return { ok: false, status: 415, error: `Unsupported file type: ${file.type}` }
  }

  if (file.size <= 0) {
    return { ok: false, status: 400, error: 'File is empty' }
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, status: 413, error: 'File exceeds max size of 20MB' }
  }

  return { ok: true, extension }
}
