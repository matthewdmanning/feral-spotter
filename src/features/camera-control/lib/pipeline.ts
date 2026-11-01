/**
 * Seams reserved for identification work that is not built yet. Neither has an
 * implementation in the app today, and that is deliberate: they mark where a
 * denoiser and a subject detector would attach without reopening the capture
 * path.
 *
 * ImagePostprocessor has one optional consumer, useNativeCameraCapture, which
 * nothing currently passes a postprocessor to. SubjectLocalizer has no
 * implementation and no caller. Delete either one if the corresponding feature
 * is dropped rather than leaving it to read as dead code.
 */

import type {
  NativeCapturedPhoto,
  NormalizedSubjectRegion,
} from '@/modules/native-identification-camera'

export interface ImagePostprocessor {
  process(photo: NativeCapturedPhoto): Promise<NativeCapturedPhoto>
}

export interface SubjectLocalizer {
  locate(input: unknown): Promise<NormalizedSubjectRegion | null>
}
