import { isNativeIdentificationCameraAvailable } from '@/modules/native-identification-camera'
import {
  GoHomeGate,
  RestoreFailedGate,
} from '@/src/shared/ui/molecules/GateScreen'
import { useDraftStartupStore } from '@/src/features/draft-submission/hooks/useDraftStartupStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSettingsStore } from '@/src/features/settings/hooks/useSettingsStore'
import { LegacyCameraScreen } from './LegacyCameraScreen'
import { NativeCameraScreen } from './NativeCameraScreen'

export default function CameraScreen() {
  const phase = useDraftStartupStore((state) => state.phase)
  const photoSource = usePhotoStore((state) => state.source)
  const nativeCameraEnabled = useSettingsStore(
    (state) => state.settings.native_camera_capture === true,
  )
  const useNativeCamera =
    nativeCameraEnabled && isNativeIdentificationCameraAvailable()

  if (phase === 'error') {
    return <RestoreFailedGate />
  }

  if (phase === 'ready' && photoSource === 'library') {
    return (
      <GoHomeGate
        title="Camera Unavailable"
        body="This sighting uses library photos. Finish or reset it on Home to take photos."
      />
    )
  }

  return useNativeCamera ? <NativeCameraScreen /> : <LegacyCameraScreen />
}
