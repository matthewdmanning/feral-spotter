import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import { LegacyCameraScreen } from './LegacyCameraScreen'
import { NativeCameraScreen } from './NativeCameraScreen'

export default function CameraScreen() {
  const nativeCameraEnabled = useSettingsStore(
    (state) => state.settings.native_camera_capture === true,
  )

  return nativeCameraEnabled ? <NativeCameraScreen /> : <LegacyCameraScreen />
}
