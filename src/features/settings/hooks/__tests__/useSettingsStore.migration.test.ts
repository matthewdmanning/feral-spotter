/**
 * zustand drops a persisted store whose version differs and has no migrate.
 * A store saved before v1 must keep what the user saved.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

const persisted = (version: number) =>
  JSON.stringify({
    state: { settings: { native_camera_capture: false } },
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

describe('useSettingsStore migration', () => {
  it.each([0, 1])('keeps settings saved at v%i', async (version) => {
    const settings = await loadRehydrated(persisted(version))
    expect(settings.native_camera_capture).toBe(false)
  })
})
