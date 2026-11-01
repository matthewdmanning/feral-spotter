/**
 * Pinch zoom ships on, but the old default (off) was persisted with the other
 * settings. Without the migration an existing install keeps zoom off for good.
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
  let store: typeof import('../useSettingsStore').useSettingsStore | undefined
  jest.isolateModules(() => {
    store = require('../useSettingsStore').useSettingsStore
  })
  await store!.persist.rehydrate()
  return store!.getState().settings
}

describe('useSettingsStore pinch zoom migration', () => {
  it('turns zoom on for an install saved before it shipped on', async () => {
    const settings = await loadRehydrated(persisted(0, false))
    expect(settings.camera_pinch_zoom).toBe(true)
    // The rest of what the user saved is kept.
    expect(settings.native_camera_capture).toBe(false)
  })

  it('keeps a choice made after the migration', async () => {
    const settings = await loadRehydrated(persisted(1, false))
    expect(settings.camera_pinch_zoom).toBe(false)
  })

  it('starts a new install with zoom on', async () => {
    const settings = await loadRehydrated(null)
    expect(settings.camera_pinch_zoom).toBe(true)
  })
})
