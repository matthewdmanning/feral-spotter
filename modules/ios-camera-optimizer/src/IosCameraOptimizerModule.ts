import { NativeModule, requireNativeModule } from 'expo'
import { Platform } from 'react-native'

declare class IosCameraOptimizerNativeModule extends NativeModule {
  configureForIdentification(deviceId: string): Promise<boolean>
  restoreAutomaticCapture(deviceId: string): Promise<boolean>
}

const nativeModule =
  Platform.OS === 'ios'
    ? requireNativeModule<IosCameraOptimizerNativeModule>('IosCameraOptimizer')
    : null

export async function configureIosCameraForIdentification(
  deviceId: string,
): Promise<boolean> {
  if (!nativeModule) return false
  return nativeModule.configureForIdentification(deviceId)
}

export async function restoreIosAutomaticCapture(
  deviceId: string,
): Promise<boolean> {
  if (!nativeModule) return false
  return nativeModule.restoreAutomaticCapture(deviceId)
}
