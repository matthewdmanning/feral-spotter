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
    },
  ),
)
