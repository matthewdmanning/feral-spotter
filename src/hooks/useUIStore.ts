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
  showError: (title: string, message: string) => void
  showSuccess: (title: string, message: string) => void
  setSubmitting: (isSubmitting: boolean) => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isOnline: true,
      isSubmitting: false,

      setOnlineStatus: (isOnline) => set({ isOnline }),

      showError: (title, message) => Alert.alert(title, message),
      showSuccess: (title, message) => Alert.alert(title, message),

      setSubmitting: (isSubmitting) => set({ isSubmitting }),
    }),
    {
      name: 'ui-store',
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
)
