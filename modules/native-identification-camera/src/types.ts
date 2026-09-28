import type { StyleProp, ViewStyle } from 'react-native'

export type NativeCameraPosition = 'back' | 'front'
export type NativeFlashMode = 'off' | 'on' | 'auto'

/**
 * A capture result. The view reports what it produced and nothing more: the
 * capture instant is stamped in JS at the shutter, because a native stamp
 * meant a different instant on each platform.
 */
export interface NativeCapturedPhoto {
  uri: string
  width: number
  height: number
}

/**
 * What the view reports once a session is bound. captureTuning names the
 * resolved tuning combination and captureMode is the platform's own capture
 * mode constant, so a profiling run can tell which mode actually ran instead of
 * inferring it from the settings that asked for it.
 */
export interface NativeCameraReadyEvent {
  captureTuning?: string
  captureMode?: number
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
  disableLowLightBoost: boolean
  subjectMetering: boolean
  /** Driven by the camera_performance_checks setting. Off means the view reports nothing. */
  diagnostics: boolean
  onCameraReady?: (event: { nativeEvent?: NativeCameraReadyEvent }) => void
  onCameraDiagnostic?: (event: {
    nativeEvent?: NativeCameraDiagnosticEvent
  }) => void
  onCameraError?: (event: { nativeEvent?: { message?: string } }) => void
  style?: StyleProp<ViewStyle>
}
