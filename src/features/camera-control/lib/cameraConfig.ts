/**
 * The camera settings a capture ran with, in the form its photo's Storage
 * metadata takes (PhotoCameraConfig: string values, written as
 * `camera_<key>` at Submit). One builder per capture backend, because each
 * knows different things about its capture.
 */

import type { NativeCapturedPhoto } from '@/modules/native-identification-camera'
import type { PhotoCameraConfig } from '@/src/shared/types'

interface NativeCaptureContext {
  platform: string
  position: string
  flashMode: string
  maxDetail: boolean
  motionPriority: boolean
  lowLightBoostDisabled: boolean
  subjectMetering: boolean
  captured: Pick<NativeCapturedPhoto, 'captureMode' | 'captureSettings'>
}

/**
 * Use this function to describe a native-backend capture. The view's own
 * captureSettings (Android) are spread last: they name what CameraX actually
 * ran, where the settings props only name what was asked for.
 */
export function nativeCameraConfig({
  platform,
  position,
  flashMode,
  maxDetail,
  motionPriority,
  lowLightBoostDisabled,
  subjectMetering,
  captured,
}: NativeCaptureContext): PhotoCameraConfig {
  return {
    backend: platform === 'ios' ? 'avfoundation' : 'camerax',
    platform,
    position,
    flash_mode: flashMode,
    max_detail: String(maxDetail),
    motion_priority: String(motionPriority),
    low_light_boost_disabled: String(lowLightBoostDisabled),
    subject_metering: String(subjectMetering),
    ...(captured.captureMode !== undefined && {
      capture_mode: captured.captureMode,
    }),
    ...captured.captureSettings,
  }
}

interface VisionCameraCaptureContext {
  platform: string
  position: string
  flashMode: string
  /** 'single' or 'burst': the shutter behaviour, not a CameraX capture mode. */
  shutterMode: string
  capturePipeline: string
  qualityPrioritization: string | undefined
  lowLightBoost: boolean
}

/** Use this function to describe a VisionCamera-backend capture. */
export function visionCameraConfig({
  platform,
  position,
  flashMode,
  shutterMode,
  capturePipeline,
  qualityPrioritization,
  lowLightBoost,
}: VisionCameraCaptureContext): PhotoCameraConfig {
  return {
    backend: 'visioncamera',
    platform,
    position,
    flash_mode: flashMode,
    shutter_mode: shutterMode,
    capture_pipeline: capturePipeline,
    quality_prioritization: qualityPrioritization ?? 'default',
    low_light_boost: String(lowLightBoost),
  }
}
