import type { StyleProp, ViewStyle } from 'react-native'

export type NativeCameraPosition = 'back' | 'front'
export type NativeFlashMode = 'off' | 'on' | 'auto'

/**
 * Android only. A field condition selects a candidate still-capture config
 * (`FieldCaptureConfig.kt`) in place of the capture tuning. The preview is the
 * same whichever is set. The names must match `FieldCondition.telemetryName`
 * in Kotlin; this list is the only JS copy.
 */
export const NATIVE_FIELD_CONDITIONS = [
  'low_light',
  'distant_motion',
  'fine_detail',
] as const

export type NativeFieldCondition = (typeof NATIVE_FIELD_CONDITIONS)[number]

/**
 * A capture result. The view reports what it produced and nothing more: the
 * capture instant is stamped in JS at the shutter, because a native stamp
 * meant a different instant on each platform.
 */
export interface NativeCapturedPhoto {
  uri: string
  width: number
  height: number
  /** Android only: the capture mode CameraX ran for this capture, after any ZSL fallback. */
  captureMode?: string
  /**
   * Android only: the DNG written beside the JPEG when the field capture config
   * resolved to RAW+JPEG. `uri` is still the JPEG. Absent when no DNG was kept.
   * It is a cache file; the draft deletes it after a send or a discard.
   */
  rawUri?: string
  /**
   * Android only: the settings this capture ran with (`CaptureSettings.kt`),
   * by name, as strings — capture mode, tuning, field condition, output
   * format, JPEG quality, frame-rate range, and each Camera2 key it set.
   * Written to the photo's Storage metadata as-is.
   */
  captureSettings?: Readonly<Record<string, string>>
}

/**
 * What the view reports once a session is bound. requestedCaptureTuning names
 * the tuning combination the settings asked for. captureMode (Android only)
 * names the mode CameraX runs after any ZSL fallback, assuming flash off; each
 * capture reports its own.
 */
export interface NativeCameraReadyEvent {
  requestedCaptureTuning?: string
  captureMode?: string
  /** Android only: the bound resolution configuration disables ZSL. */
  zslDisabledByConfig?: boolean
  /** Android only, present when a field condition built the capture use case. */
  fieldCondition?: NativeFieldCondition
  /** Android only: `jpeg` or `raw_jpeg`, after the device's format check. */
  outputFormat?: string
}

/**
 * One session diagnostic from the native view. `event` names what happened and
 * the rest of the payload is whatever that event reports, so the React Native
 * layer can forward it without knowing the set of events.
 */
export interface NativeCameraDiagnosticEvent {
  event: string
  [field: string]: string | number | boolean | undefined
}

export interface NativeCaptureOptions {
  flashMode: NativeFlashMode
}

export interface NormalizedSubjectRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface NativeIdentificationCameraRef {
  capture(options: NativeCaptureOptions): Promise<NativeCapturedPhoto>
  focus(point: { x: number; y: number }): Promise<boolean>
  setSubjectRegion(region: NormalizedSubjectRegion | null): Promise<boolean>
}

export interface NativeIdentificationCameraProps {
  isActive: boolean
  position: NativeCameraPosition
  maxDetail: boolean
  motionPriority: boolean
  /** Android only. Absent or null keeps the capture tuning. */
  fieldCondition?: NativeFieldCondition | null
  disableLowLightBoost: boolean
  subjectMetering: boolean
  /**
   * Pinch to zoom the preview. On Android this magnifies the preview only: the
   * sensor stays at 1x, so the saved photo is still full field and full
   * resolution, and a small map shows the part on screen. iOS still zooms the
   * camera itself, so an iOS capture is cropped.
   */
  pinchZoom: boolean
  /** Driven by the camera_performance_checks setting. Off means the view reports nothing. */
  diagnostics: boolean
  onCameraReady?: (event: { nativeEvent?: NativeCameraReadyEvent }) => void
  onCameraDiagnostic?: (event: {
    nativeEvent?: NativeCameraDiagnosticEvent
  }) => void
  onCameraError?: (event: { nativeEvent?: { message?: string } }) => void
  style?: StyleProp<ViewStyle>
}
