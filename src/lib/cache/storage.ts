/**
 * utils/storage.ts
 * AsyncStorage-backed Zustand persist storage adapter.
 *
 * Usage in any Zustand store:
 *
 *   import { persist, createJSONStorage } from 'zustand/middleware'
 *   import { asyncStorage } from '@/src/lib/cache/storage'
 *
 *   export const useSubmissionStore = create(
 *     persist(
 *       (set, get) => ({ ... }),
 *       {
 *         name: 'submission-store',
 *         storage: createJSONStorage(() => asyncStorage),
 *       }
 *     )
 *   )
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
// react-native-mmkv stays installed solely for src/config/unistyles.ts's
// synchronous theme read (that file is being migrated away from separately).
import { createMMKV } from "react-native-mmkv";

export const mmkvInstance = createMMKV({ id: "feralspotter" });

export const asyncStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

const PERSISTED_STORE_KEYS = [
  "ui-store",
  "annotation-store",
  "submission-store",
  "bounding-box-store",
  "settings-store",
  "photo-store",
];

/**
 * Clears all persisted Zustand store data.
 * Call from settings "Clear Cache" handler instead of (or alongside) clearCache().
 */
export async function clearAllStores(): Promise<void> {
  await AsyncStorage.multiRemove(PERSISTED_STORE_KEYS);
}
