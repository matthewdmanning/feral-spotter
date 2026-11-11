/**
 * features/settings/hooks/useSettingsDraft.ts
 * Manages the settings screen draft pattern.
 * Screen receives everything via this hook — no business logic in the component.
 */

import { settingsCopy } from '@/src/features/settings/copy/settingsCopy'
import { commonCopy } from '@/src/shared/config/text'
import { showAlert, showSuccess } from '@/src/shared/hooks/useUIStore'
import { useState } from 'react'

import { useSettingsStore } from '@/src/features/settings/hooks/useSettingsStore'
import type { AppSettings } from '@/src/features/settings/hooks/useSettingsStore'

export interface SettingsDraftResult {
  draft: AppSettings
  patch: (key: keyof AppSettings, value: unknown) => void
  handleSave: () => void
  handleDiscard: () => void
}

export function useSettingsDraft(): SettingsDraftResult {
  const savedSettings = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  const [changes, setChanges] = useState<Partial<AppSettings>>({})
  const draft = { ...savedSettings, ...changes }

  const patch = (key: keyof AppSettings, value: unknown) =>
    setChanges((current) => ({ ...current, [key]: value }))

  const handleSave = () => {
    updateSettings(changes)
    setChanges({})
    showSuccess(settingsCopy.savedTitle, settingsCopy.savedMessage)
  }

  const handleDiscard = () => {
    showAlert(settingsCopy.discardTitle, settingsCopy.discardMessage, [
      { text: commonCopy.cancel, style: 'cancel' },
      {
        text: settingsCopy.discard,
        style: 'destructive',
        onPress: () => {
          setChanges({})
        },
      },
    ])
  }

  return { draft, patch, handleSave, handleDiscard }
}
