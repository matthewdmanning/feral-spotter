import { requireOptionalNativeModule } from 'expo'

export { NativeIdentificationCameraView } from './src/NativeIdentificationCameraView'
export type {
  NativeCapturedPhoto,
  NativeCameraPosition,
  NativeCaptureOptions,
  NativeFlashMode,
  NativeIdentificationCameraProps,
  NativeIdentificationCameraRef,
  NormalizedSubjectRegion,
} from './src/types'

export function isNativeIdentificationCameraAvailable(): boolean {
  return requireOptionalNativeModule('NativeIdentificationCamera') != null
}
