/**
 * The three native-camera capture priorities and their persisted boolean
 * representation.
 */

export type CapturePriority = 'speed' | 'balanced' | 'quality'

export interface CapturePrioritySettings {
  camera_max_detail: boolean
  camera_motion_priority: boolean
}

export const CAPTURE_PRIORITY_SETTINGS: Readonly<
  Record<CapturePriority, CapturePrioritySettings>
> = {
  speed: { camera_max_detail: false, camera_motion_priority: true },
  balanced: { camera_max_detail: true, camera_motion_priority: true },
  quality: { camera_max_detail: true, camera_motion_priority: false },
}
