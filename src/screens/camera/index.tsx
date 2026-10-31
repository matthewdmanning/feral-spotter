import { isNativeIdentificationCameraAvailable } from '@/modules/native-identification-camera'
import { GateScreen } from '@/src/components/molecules/GateScreen'
import { useDraftStartupStore } from '@/src/hooks/useDraftStartupStore'
import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import { router } from 'expo-router'
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
    return (
      <GateScreen
        title="Could Not Restore Your Sighting"
        body="Restart the app to try again."
        primaryLabel="Go Home"
        onPrimary={() => router.replace('/')}
      />
    )
  }

  if (phase === 'ready' && photoSource === 'library') {
    return (
      <GateScreen
        title="Camera Unavailable"
        body="This sighting uses library photos. Finish or reset it on Home to take photos."
        primaryLabel="Go Home"
        onPrimary={() => router.replace('/')}
      />
    )
  }

  return useNativeCamera ? <NativeCameraScreen /> : <LegacyCameraScreen />
}
