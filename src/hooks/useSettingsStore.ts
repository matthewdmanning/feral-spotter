/**
 * hooks/useSettingsStore.ts
 * Persisted Zustand store for user-configurable app settings.
 */

import { mmkvStorage } from "@/src/lib/cache/storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppSettings {
  cache_ttl_days: number;
  delete_unused_photos: boolean;
  delete_all_photos: boolean;
  keep_photos_on_device: boolean;
  annotation_enabled: boolean;
  skip_photo_remove_confirm: boolean;
}

interface SettingsState {
  settings: AppSettings;

  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  cache_ttl_days: 30,
  delete_unused_photos: false,
  delete_all_photos: false,
  keep_photos_on_device: true,
  annotation_enabled: true,
  skip_photo_remove_confirm: false,
};

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
      name: "settings-store",
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
