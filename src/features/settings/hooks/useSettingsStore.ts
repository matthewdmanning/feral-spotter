/**
 * features/settings/hooks/useSettingsStore.ts
 * Persisted Zustand store for user-configurable app settings.
 */

import { asyncStorage } from '@/src/shared/lib/storage'
import { CAPTURE_PRIORITY_SETTINGS } from '@/src/features/settings/config/capturePriority'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface AppSettings {
  keep_photos_on_device: boolean
  annotation_enabled: boolean
  skip_photo_remove_confirm: boolean
  /**
   * @deprecated The native camera is the capture backend, so this has no
   * Settings control. It only still shapes the VisionCamera fallback.
   */
  improved_camera_capture: boolean
  ios_improved_camera_capture: boolean
  camera_performance_checks: boolean
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
 * Camera test-drive flags set build defaults. Persisted settings take
 * precedence through `merge` below. See docs/agents/builds.md for environment
 * files and docs/agents/test-driving.md for a fresh test installation.
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
  camera_max_detail: true,
  camera_motion_priority: true,
  camera_disable_low_light_boost: false,
  camera_subject_metering: envDefault(
    process.env.EXPO_PUBLIC_CAMERA_SUBJECT_METERING,
    false,
  ),
}

/**
 * Use this function when settings enter or leave the persisted store so the
 * legacy false/false capture pair is represented by the canonical Balanced
 * choice. It relies on `CAPTURE_PRIORITY_SETTINGS` for that canonical pair.
 */
function normalizeSettings(settings: AppSettings): AppSettings {
  if (settings.camera_max_detail || settings.camera_motion_priority) {
    return settings
  }

  return {
    ...settings,
    ...CAPTURE_PRIORITY_SETTINGS.balanced,
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: { ...DEFAULT_SETTINGS },

      updateSetting: (key, value) =>
        set((s) => ({
          settings: normalizeSettings({ ...s.settings, [key]: value }),
        })),

      updateSettings: (patch) =>
        set((s) => ({
          settings: normalizeSettings({ ...s.settings, ...patch }),
        })),
    }),
    {
      name: 'settings-store',
      storage: createJSONStorage(() => asyncStorage),
      // Installs are saved at v1. Without a migrate, zustand drops a store saved
      // at another version, so older stores pass through and merge below.
      version: 1,
      migrate: (persisted) => persisted as SettingsState,
      merge: (persisted, current) => {
        const persistedSettings = (
          persisted as Partial<SettingsState> | undefined
        )?.settings
        return {
          ...current,
          settings: normalizeSettings({
            ...DEFAULT_SETTINGS,
            ...persistedSettings,
          }),
        }
      },
    },
  ),
)
