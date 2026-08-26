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

import AsyncStorage from '@react-native-async-storage/async-storage'
// react-native-mmkv backs the theme-mode read in src/config/unistyles.ts, which
// has to be synchronous: Unistyles resolves the initial theme before first
// render, so an AsyncStorage read would paint the wrong theme and then flip it.
// That read was previously vestigial and slated for removal; it is now the real
// persistence path behind the System/Light/Dark control, so MMKV stays.
import { createMMKV } from 'react-native-mmkv'

export const mmkvInstance = createMMKV({ id: 'feralspotter' })

export const asyncStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
}
