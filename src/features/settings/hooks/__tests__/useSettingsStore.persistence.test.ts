import AsyncStorage from '@react-native-async-storage/async-storage'

const persisted = (pinch: boolean) =>
  JSON.stringify({
    state: {
      settings: { camera_pinch_zoom: pinch, native_camera_capture: false },
    },
    version: 0,
  })

const loadRehydrated = async (stored: string | null) => {
  if (stored !== null) await AsyncStorage.setItem('settings-store', stored)
  let store:
    | typeof import('@/src/features/settings/hooks/useSettingsStore').useSettingsStore
    | undefined
  jest.isolateModules(() => {
    store = jest.requireActual<
      typeof import('@/src/features/settings/hooks/useSettingsStore')
    >('@/src/features/settings/hooks/useSettingsStore').useSettingsStore
  })
  await store!.persist.rehydrate()
  return store!.getState().settings
}

describe('useSettingsStore persistence', () => {
  it('keeps an explicitly saved pinch zoom choice', async () => {
    const settings = await loadRehydrated(persisted(false))
    expect(settings.camera_pinch_zoom).toBe(false)
    expect(settings.native_camera_capture).toBe(false)
  })
  it('starts a new install with zoom on', async () => {
    const settings = await loadRehydrated(null)
    expect(settings.camera_pinch_zoom).toBe(true)
  })
})
