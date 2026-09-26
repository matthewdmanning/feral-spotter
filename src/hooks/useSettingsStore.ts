/**
 * hooks/useSettingsStore.ts
 * Persisted Zustand store for user-configurable app settings.
 */

import { asyncStorage } from '@/src/lib/cache/storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppSettings {
  keep_photos_on_device: boolean
  annotation_enabled: boolean
  skip_photo_remove_confirm: boolean
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

const DEFAULT_SETTINGS: AppSettings = {
  keep_photos_on_device: true,
  annotation_enabled: true,
  skip_photo_remove_confirm: false,
  native_camera_capture: false,
  camera_max_detail: true,
  camera_motion_priority: true,
  camera_disable_low_light_boost: false,
  camera_subject_metering: false,
}

// ─── Store ────────────────────────────────────────────────────────────────────

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
        const persistedState = persisted as Partial<SettingsState> | undefined
        return {
          ...current,
          ...persistedState,
          settings: {
            ...DEFAULT_SETTINGS,
            ...persistedState?.settings,
          },
        }
      },
    },
  ),
)
