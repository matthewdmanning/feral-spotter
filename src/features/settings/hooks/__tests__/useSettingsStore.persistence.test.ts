/**
 * zustand drops a persisted store whose version differs and has no migrate.
 * A store saved before v1 must keep what the user saved.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

const persisted = (version: number, pinch: boolean) =>
  JSON.stringify({
    state: {
      settings: { camera_pinch_zoom: pinch, native_camera_capture: false },
    },
    version,
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
  it.each([0, 1])('keeps settings saved at v%i', async (version) => {
    const settings = await loadRehydrated(persisted(version, false))
    expect(settings.native_camera_capture).toBe(false)
  })
  it('keeps an explicitly saved pinch zoom choice', async () => {
    const settings = await loadRehydrated(persisted(0, false))
    expect(settings.camera_pinch_zoom).toBe(false)
    expect(settings.native_camera_capture).toBe(false)
  })
  it('starts a new install with zoom on', async () => {
    const settings = await loadRehydrated(null)
    expect(settings.camera_pinch_zoom).toBe(true)
  })
})
