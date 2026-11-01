import { isUsable } from '../cameraPermission'

// react-native-vision-camera's module-scope require of NitroModules only
// resolves inside a real native runtime — mocked here purely so the import
// doesn't throw; isUsable itself never touches VisionCamera.
jest.mock('react-native-vision-camera', () => ({ VisionCamera: {} }))

describe('cameraPermission.isUsable (#358)', () => {
  it('is usable only when authorized', () => {
    expect(isUsable('authorized')).toBe(true)
  })

  it('gates a first-time "Don\'t allow" (not-determined) — #66/#237', () => {
    expect(isUsable('not-determined')).toBe(false)
  })

  it('gates a second denial', () => {
    expect(isUsable('denied')).toBe(false)
  })

  it('gates restricted (e.g. parental controls)', () => {
    expect(isUsable('restricted')).toBe(false)
  })
})
