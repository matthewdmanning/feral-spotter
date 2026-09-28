/**
 * hooks/useSettingsStore.ts
 * Persisted Zustand store for user-configurable app settings.
 */

import { asyncStorage } from '@/src/lib/cache/storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface AppSettings {
  keep_photos_on_device: boolean
  annotation_enabled: boolean
  skip_photo_remove_confirm: boolean
  improved_camera_capture: boolean
  ios_improved_camera_capture: boolean
  camera_performance_checks: boolean
  native_camera_capture: boolean
  camera_max_detail: boolean
  camera_motion_priority: boolean
  camera_disable_low_light_boost: boolean
  camera_subject_metering: boolean
}

interface SettingsState {
  settings: AppSettings

  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => void
  updateSettings: (patch: Partial<AppSettings>) => void
}

/**
 * Reads a build-time default for a setting. `undefined` means the variable was
 * not supplied, so the shipped default stands.
 *
 * The value has to be passed in already resolved: Expo inlines
 * `process.env.EXPO_PUBLIC_*` at build time only for a literal member
 * expression, so `process.env[key]` would read nothing.
 */
const envDefault = (value: string | undefined, shipped: boolean): boolean =>
  value === undefined || value === '' ? shipped : value === 'true'

/**
 * Three camera settings ship off and have to be on for a native-camera test
 * drive, which meant three manual toggles at the start of every run. An Android
 * drive sets them in `.env.android.local`, which only `npm run android` loads,
 * so no other platform and no release build is affected.
 *
 * These are defaults, not overrides: a value already persisted wins, which is
 * what `merge` below does. `npm run android` clears app storage first, so a
 * drive starts from these.
 */
const DEFAULT_SETTINGS: AppSettings = {
  keep_photos_on_device: true,
  annotation_enabled: true,
  skip_photo_remove_confirm: false,
  improved_camera_capture: false,
  ios_improved_camera_capture: false,
  camera_performance_checks: envDefault(
    process.env.EXPO_PUBLIC_CAMERA_PERFORMANCE_CHECKS,
    false,
  ),
  native_camera_capture: envDefault(
    process.env.EXPO_PUBLIC_NATIVE_CAMERA_CAPTURE,
    false,
  ),
  camera_max_detail: true,
  camera_motion_priority: true,
  camera_disable_low_light_boost: false,
  camera_subject_metering: envDefault(
    process.env.EXPO_PUBLIC_CAMERA_SUBJECT_METERING,
    false,
  ),
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: { ...DEFAULT_SETTINGS },

      updateSetting: (key, value) =>
        set((s) => ({ settings: { ...s.settings, [key]: value } })),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: 'settings-store',
      storage: createJSONStorage(() => asyncStorage),
      merge: (persisted, current) => {
        const persistedSettings = (
          persisted as Partial<SettingsState> | undefined
        )?.settings
        return {
          ...current,
          settings: {
            ...DEFAULT_SETTINGS,
            ...persistedSettings,
          },
        }
      },
    },
  ),
)
