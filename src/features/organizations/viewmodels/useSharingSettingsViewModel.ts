import { useState } from 'react'
import { useAuth } from '@/src/features/auth/lib/useAuth'
import {
  EMPTY_ORGANIZATION_ACCOUNT,
  useOrganizationSharingStore,
} from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import type { SharingSettings } from '@/src/shared/types/Organizations'

/** Coordinates account scoped sharing preferences for the Settings view. */
export function useSharingSettingsViewModel() {
  const { user } = useAuth()
  const enabled = useOrganizationsFlag((state) => state.enabled)
  const hydrated = useOrganizationSharingStore((state) => state.hydrated)
  const saved = useOrganizationSharingStore((state) =>
    user
      ? (state.accounts[user.uid]?.settings ??
        EMPTY_ORGANIZATION_ACCOUNT.settings)
      : EMPTY_ORGANIZATION_ACCOUNT.settings,
  )

  if (!enabled || !user || !hydrated) return null

  return {
    uid: user.uid,
    email: user.email,
    saved,
    save: (settings: SharingSettings) =>
      useOrganizationSharingStore.getState().configure(user.uid, settings),
  }
}

/** Owns the editable draft and account-switch reset for the settings form. */
export function useSharingSettingsFormViewModel(saved: SharingSettings) {
  const [draft, setDraft] = useState(saved)
  return {
    draft,
    setField: (key: keyof SharingSettings['fields'], value: boolean) =>
      setDraft((current) => ({
        ...current,
        fields: { ...current.fields, [key]: value },
      })),
    setName: (name: string) => setDraft((current) => ({ ...current, name })),
    setPhone: (phone: string) => setDraft((current) => ({ ...current, phone })),
  }
}
