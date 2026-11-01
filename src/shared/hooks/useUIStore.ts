/**
 * shared/hooks/useUIStore.ts
 * Cross-screen UI state: connectivity and the
 * single app-owned dialog.
 *
 * Dialogs live here rather than calling `Alert.alert` directly because the
 * native alert follows the *OS* theme, not the app's — it renders dark-grey
 * over a Light app, which no theme sweep can fix. `showAlert` keeps
 * `Alert.alert`'s exact signature so call sites inside hooks and plain
 * functions (most of them) work unchanged; AlertHost draws the result.
 */

import { asyncStorage } from '@/src/shared/lib/storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Mirrors react-native's AlertButton so call sites port over untouched. */
export interface AlertButton {
  text: string
  style?: 'default' | 'cancel' | 'destructive'
  onPress?: () => void
}

export interface DialogRequest {
  title: string
  message?: string
  buttons: AlertButton[]
}

interface UIState {
  isOnline: boolean
  dialog: DialogRequest | null

  setOnlineStatus: (isOnline: boolean) => void
  dismissDialog: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isOnline: true,
      dialog: null,

      setOnlineStatus: (isOnline) => set({ isOnline }),
      dismissDialog: () => set({ dialog: null }),
    }),
    {
      name: 'ui-store',
      storage: createJSONStorage(() => asyncStorage),
      // Connectivity is the only durable bit. A rehydrated `dialog` would pop
      // a stale confirmation on cold start, with handlers whose closures died
      // with the last process.
      partialize: (s) => ({
        isOnline: s.isOnline,
      }),
    },
  ),
)

/**
 * Same shape as `Alert.alert(title, message?, buttons?)`. Callable from
 * anywhere — hooks, plain functions, event handlers — because it writes to
 * the store rather than depending on React context.
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void {
  useUIStore.setState({
    dialog: {
      title,
      message,
      // Alert.alert's own default when no buttons are given.
      buttons: buttons?.length ? buttons : [{ text: 'OK' }],
    },
  })
}

export function showError(title: string, message: string): void {
  showAlert(title, message)
}

export function showSuccess(title: string, message: string): void {
  showAlert(title, message)
}
