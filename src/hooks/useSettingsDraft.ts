/**
 * hooks/useSettingsDraft.ts
 * Manages the settings screen draft pattern, password flow, and cache actions.
 * Screen receives everything via this hook — no business logic in the component.
 */

import { useState, useEffect } from 'react'
import { Alert } from 'react-native'
import { router } from 'expo-router'
import { useUIStore, useSettingsStore } from '@/src/hooks'
import { hasPassword, removePassword, verifyPassword } from '@/src/utils/api'
import { clearCache } from '@/src/utils/cache'
import type { AppSettings } from '@/src/hooks/useSettingsStore'

export interface SettingsDraftResult {
  draft:               AppSettings
  patch:               (key: keyof AppSettings, value: unknown) => void
  passwordConfigured:  boolean
  newPassword:         string
  confirmPassword:     string
  isVerifying:         boolean
  setNewPassword:      (v: string) => void
  setConfirmPassword:  (v: string) => void
  handleSave:          () => Promise<void>
  handleDiscard:       () => void
  handleClearCache:    () => void
  handleRemovePassword: () => Promise<void>
}

export function useSettingsDraft(): SettingsDraftResult {
  const showSuccess    = useUIStore((s) => s.showSuccess)
  const showError      = useUIStore((s) => s.showError)
  const savedSettings  = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  const [draft,               setDraft]               = useState<AppSettings>({ ...savedSettings })
  const [passwordConfigured,  setPasswordConfigured]  = useState(false)
  const [newPassword,         setNewPassword]         = useState('')
  const [confirmPassword,     setConfirmPassword]     = useState('')
  const [isVerifying,         setIsVerifying]         = useState(false)

  useEffect(() => { hasPassword().then(setPasswordConfigured) }, [])
  useEffect(() => { setDraft({ ...savedSettings }) }, [savedSettings])

  const patch = (key: keyof AppSettings, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const handleSave = async () => {
    if (newPassword) {
      if (newPassword !== confirmPassword) { showError('Error', 'Passwords do not match'); return }
      if (newPassword.length < 6)          { showError('Error', 'Password must be at least 6 characters'); return }
      setIsVerifying(true)
      const valid = await verifyPassword(newPassword)
      setIsVerifying(false)
      if (!valid) { showError('Error', 'Invalid password'); return }
      setPasswordConfigured(true)
      setNewPassword('')
      setConfirmPassword('')
    }
    updateSettings(draft)
    showSuccess('Saved', 'Settings saved')
    router.back()
  }

  const handleDiscard = () => {
    Alert.alert('Discard Changes', 'Discard all unsaved changes?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes', style: 'destructive',
        onPress: () => {
          setDraft({ ...savedSettings })
          setNewPassword('')
          setConfirmPassword('')
          router.back()
        },
      },
    ])
  }

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'Remove all cached submission data? Photos are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: async () => {
          await clearCache()
          showSuccess('Cleared', 'Cache cleared')
        }},
      ],
    )
  }

  const handleRemovePassword = async () => {
    await removePassword()
    setPasswordConfigured(false)
  }

  return {
    draft, patch,
    passwordConfigured, newPassword, confirmPassword, isVerifying,
    setNewPassword, setConfirmPassword,
    handleSave, handleDiscard, handleClearCache, handleRemovePassword,
  }
}
