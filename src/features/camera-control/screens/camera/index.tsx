import { cameraCopy } from '@/src/shared/config/text'
import { isNativeIdentificationCameraAvailable } from '@/modules/native-identification-camera'
import {
  GoHomeGate,
  RestoreFailedGate,
} from '@/src/shared/ui/molecules/GateScreen'
import { useDraftStartupStore } from '@/src/features/draft-submission/hooks/useDraftStartupStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { LegacyCameraScreen } from './LegacyCameraScreen'
import { NativeCameraScreen } from './NativeCameraScreen'

export default function CameraScreen() {
  const phase = useDraftStartupStore((state) => state.phase)
  const photoSource = usePhotoStore((state) => state.source)
  const useNativeCamera = isNativeIdentificationCameraAvailable()

  if (phase === 'error') {
    return <RestoreFailedGate />
  }

  if (phase === 'ready' && photoSource === 'library') {
    return (
      <GoHomeGate
        title={cameraCopy.unavailableTitle}
        body={cameraCopy.unavailableBody}
      />
    )
  }

  return useNativeCamera ? <NativeCameraScreen /> : <LegacyCameraScreen />
}
