import { Platform } from 'react-native'
import { isUsable } from '../locationPermission'

describe('locationPermission.isUsable (#358)', () => {
  const originalOS = Platform.OS

  afterEach(() => {
    Platform.OS = originalOS
  })

  it('gates when not granted at all', () => {
    expect(isUsable({ granted: false })).toBe(false)
  })

  it('is usable on Android with fine accuracy', () => {
    Platform.OS = 'android'
    expect(isUsable({ granted: true, android: { accuracy: 'fine' } })).toBe(
      true,
    )
  })

  it('gates Android coarse-only ("Approximate") access — #66', () => {
    Platform.OS = 'android'
    expect(isUsable({ granted: true, android: { accuracy: 'coarse' } })).toBe(
      false,
    )
  })

  it('does NOT gate iOS "reduced" accuracy — real, working state unlike Android coarse', () => {
    Platform.OS = 'ios'
    expect(isUsable({ granted: true, ios: { accuracy: 'reduced' } })).toBe(true)
  })
})
