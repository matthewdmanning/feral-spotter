/**
 * zustand drops a persisted store whose version differs and has no migrate.
 * A store saved before v1 must keep what the user saved.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

const persisted = (version: number) =>
  JSON.stringify({
    state: { settings: { keep_photos_on_device: false } },
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
    expect(settings.keep_photos_on_device).toBe(false)
  })

  it('normalizes a legacy false/false capture priority to Balanced', async () => {
    const settings = await loadRehydrated(
      JSON.stringify({
        state: {
          settings: {
            camera_max_detail: false,
            camera_motion_priority: false,
          },
        },
        version: 1,
      }),
    )

    expect(settings.camera_max_detail).toBe(true)
    expect(settings.camera_motion_priority).toBe(true)
  })
})
