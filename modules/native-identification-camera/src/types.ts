export type NativeCameraPosition = 'back' | 'front'
export type NativeFlashMode = 'off' | 'on' | 'auto'

export interface NativeCapturedPhoto {
  uri: string
  width: number
  height: number
  capturedAt: string
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
  style?: unknown
}
