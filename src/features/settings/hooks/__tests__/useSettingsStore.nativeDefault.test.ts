describe('useSettingsStore native camera default', () => {
  const originalValue = process.env.EXPO_PUBLIC_NATIVE_CAMERA_CAPTURE

  afterEach(() => {
    if (originalValue === undefined)
      delete process.env.EXPO_PUBLIC_NATIVE_CAMERA_CAPTURE
    else process.env.EXPO_PUBLIC_NATIVE_CAMERA_CAPTURE = originalValue
    jest.resetModules()
  })

  const loadNativeCameraDefault = (envValue?: string) => {
    if (envValue === undefined)
      delete process.env.EXPO_PUBLIC_NATIVE_CAMERA_CAPTURE
    else process.env.EXPO_PUBLIC_NATIVE_CAMERA_CAPTURE = envValue

    const { useSettingsStore } = require('../useSettingsStore')
    return useSettingsStore.getState().settings.native_camera_capture
  }

  const cases: [string | undefined, boolean][] = [
    [undefined, true],
    ['true', true],
    ['false', false],
  ]

  it.each(cases)('resolves %p to %p', (envValue, expected) => {
    expect(loadNativeCameraDefault(envValue)).toBe(expected)
  })
})
