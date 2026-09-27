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
