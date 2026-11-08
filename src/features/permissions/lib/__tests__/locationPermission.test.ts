import {
  PermissionStatus,
  type LocationPermissionResponse,
} from 'expo-location'
import { Platform } from 'react-native'
import { isUsable } from '@/src/features/permissions/lib/locationPermission'

/** A complete expo-location response; tests override only what they test. */
const response = (
  patch: Partial<LocationPermissionResponse>,
): LocationPermissionResponse => ({
  status: patch.granted ? PermissionStatus.GRANTED : PermissionStatus.DENIED,
  expires: 'never',
  canAskAgain: true,
  granted: false,
  ...patch,
})

describe('locationPermission.isUsable (#358)', () => {
  const originalOS = Platform.OS

  afterEach(() => {
    Platform.OS = originalOS
  })

  it('gates when not granted at all', () => {
    expect(isUsable(response({ granted: false }))).toBe(false)
  })

  it('is usable on Android with fine accuracy', () => {
    Platform.OS = 'android'
    expect(
      isUsable(response({ granted: true, android: { accuracy: 'fine' } })),
    ).toBe(true)
  })

  it('gates Android coarse-only ("Approximate") access — #66', () => {
    Platform.OS = 'android'
    expect(
      isUsable(response({ granted: true, android: { accuracy: 'coarse' } })),
    ).toBe(false)
  })

  it('does NOT gate iOS "reduced" accuracy — real, working state unlike Android coarse', () => {
    Platform.OS = 'ios'
    expect(
      isUsable(
        response({
          granted: true,
          ios: { accuracy: 'reduced', scope: 'whenInUse' },
        }),
      ),
    ).toBe(true)
  })
})
