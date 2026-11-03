/**
 * hooks/useSettingsDraft.ts
 * Manages the settings screen draft pattern.
 * Screen receives everything via this hook — no business logic in the component.
 */

import { showAlert, showSuccess } from '@/src/hooks/useUIStore'
import { useState } from 'react'

import { router } from 'expo-router'
import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import type { AppSettings } from '@/src/hooks/useSettingsStore'

export interface SettingsDraftResult {
  draft: AppSettings
  patch: (key: keyof AppSettings, value: unknown) => void
  handleSave: () => void
  handleDiscard: () => void
}

export function useSettingsDraft(): SettingsDraftResult {
  const savedSettings = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  const [draft, setDraft] = useState<AppSettings>({ ...savedSettings })

  const patch = (key: keyof AppSettings, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const handleSave = () => {
    updateSettings(draft)
    showSuccess('Saved', 'Settings saved')
    router.back()
  }

  const handleDiscard = () => {
    showAlert('Discard Changes', 'Discard all unsaved changes?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: () => {
          setDraft({ ...savedSettings })
          router.back()
        },
      },
    ])
  }

  return { draft, patch, handleSave, handleDiscard }
}
