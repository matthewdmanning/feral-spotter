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
  onCameraReady?: () => void
  onCameraError?: (event: { nativeEvent?: { message?: string } }) => void
  style?: StyleProp<ViewStyle>
}
