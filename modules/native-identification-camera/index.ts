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

// Whether the native module is linked cannot change while the app runs, so the
// answer is resolved once. The backend switch calls this from a component that
// subscribes to the settings store, so it used to re-run on every settings
// change.
let isAvailable: boolean | null = null

export function isNativeIdentificationCameraAvailable(): boolean {
  isAvailable ??=
    requireOptionalNativeModule('NativeIdentificationCamera') != null
  return isAvailable
}
