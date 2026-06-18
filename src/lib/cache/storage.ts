/**
 * utils/storage.ts
 * MMKV-backed Zustand persist storage adapter.
 *
 * react-native-mmkv uses JSI — reads/writes are synchronous and
 * never touch the JS bridge. ~50× faster than AsyncStorage for
 * store hydration on cold start.
 *
 * Install: npx expo install react-native-mmkv
 * Requires Expo Prebuild (not Expo Go).
 *
 * Usage in any Zustand store:
 *
 *   import { persist, createJSONStorage } from 'zustand/middleware'
 *   import { mmkvStorage } from '@/src/lib/cache/storage'
 *
 *   export const useSubmissionStore = create(
 *     persist(
 *       (set, get) => ({ ... }),
 *       {
 *         name: 'submission-store',
 *         storage: createJSONStorage(() => mmkvStorage),
 *       }
 *     )
 *   )
 *
 * Replace every occurrence of:
 *   storage: createJSONStorage(() => AsyncStorage)
 * with:
 *   storage: createJSONStorage(() => mmkvStorage)
 *
 * Stores to update:
 *   useSubmissionStore, usePhotoStore, useAnnotationStore,
 *   useSettingsStore, useUIStore
 */

// Single shared instance for all stores.
// Use separate instances (different `id`) if you need per-store encryption.
import { createMMKV } from "react-native-mmkv";

export const mmkvInstance = createMMKV({ id: "feralspotter" });

export const mmkvStorage = {
  getItem: (key: string) => mmkvInstance.getString(key) ?? null,
  setItem: (key: string, value: string) => mmkvInstance.set(key, value),
  removeItem: (key: string) => mmkvInstance.remove(key),
};
/**
 * Clears all persisted store data.
 * Call from settings "Clear Cache" handler instead of (or alongside) clearCache().
 */
export function clearAllStores(): void {
  mmkvInstance.clearAll();
}
