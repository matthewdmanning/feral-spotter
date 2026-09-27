import { isNativeIdentificationCameraAvailable } from '@/modules/native-identification-camera'
import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import { LegacyCameraScreen } from './LegacyCameraScreen'
import { NativeCameraScreen } from './NativeCameraScreen'

export default function CameraScreen() {
  const nativeCameraEnabled = useSettingsStore(
    (state) => state.settings.native_camera_capture === true,
  )
  const useNativeCamera =
    nativeCameraEnabled && isNativeIdentificationCameraAvailable()

  return useNativeCamera ? <NativeCameraScreen /> : <LegacyCameraScreen />
}
