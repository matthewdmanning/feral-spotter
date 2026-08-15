/**
 * hooks/useUIStore.ts
 * Cross-screen UI state: connectivity and submission-in-flight status.
 * Error/success messages are surfaced immediately via Alert rather than
 * buffered in state.
 */

import { asyncStorage } from '@/src/lib/cache/storage'
import { Alert } from 'react-native'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UIState {
  isOnline: boolean
  isSubmitting: boolean

  setOnlineStatus: (isOnline: boolean) => void
  setSubmitting: (isSubmitting: boolean) => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isOnline: true,
      isSubmitting: false,

      setOnlineStatus: (isOnline) => set({ isOnline }),
      setSubmitting: (isSubmitting) => set({ isSubmitting }),
    }),
    {
      name: 'ui-store',
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
)

export function showError(title: string, message: string): void {
  Alert.alert(title, message)
}

export function showSuccess(title: string, message: string): void {
  Alert.alert(title, message)
}
