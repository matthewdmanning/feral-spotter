import { useState } from 'react'
import { Text } from '@/src/shared/ui/atoms/Text'
import { organizationCopy } from '@/src/shared/config/text'
import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { useAuth } from '@/src/features/auth/lib/useAuth'
import {
  useOrganizationSharingStore,
  EMPTY_ORGANIZATION_ACCOUNT,
} from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import type { SharingSettings as SharingConfiguration } from '@/src/shared/types/Organizations'
import { SharingFieldInputs } from '@/src/features/organizations/components/SharingFieldInputs'
import { styles } from '@/src/features/organizations/components/styles'

export function SharingSettings() {
  const { user } = useAuth()
  const enabled = useOrganizationsFlag((s) => s.enabled)
  const hydrated = useOrganizationSharingStore((s) => s.hydrated)
  const saved = useOrganizationSharingStore((s) =>
    user
      ? (s.accounts[user.uid]?.settings ?? EMPTY_ORGANIZATION_ACCOUNT.settings)
      : EMPTY_ORGANIZATION_ACCOUNT.settings,
  )
  if (!enabled || !user || !hydrated) return null
  // A different account starts from its own saved values.
  return (
    <SharingSettingsForm
      key={user.uid}
      uid={user.uid}
      email={user.email}
      saved={saved}
    />
  )
}

function SharingSettingsForm({
  uid,
  email,
  saved,
}: {
  uid: string
  email: string | null
  saved: SharingConfiguration
}) {
  const [draft, setDraft] = useState(saved)
  return (
    <GlassSurface kind="card" style={styles.card}>
      <Text style={styles.title}>{organizationCopy.sharingSettings.title}</Text>
      <Text style={styles.body}>
        {organizationCopy.sharingSettings.description}
      </Text>
      <Text style={styles.hint}>
        {organizationCopy.sharingSettings.includedNotice}
      </Text>
      <SharingFieldInputs settings={draft} email={email} onChange={setDraft} />
      <AppButton
        onPress={() =>
          useOrganizationSharingStore.getState().configure(uid, draft)
        }
      >
        {organizationCopy.sharingSettings.save}
      </AppButton>
    </GlassSurface>
  )
}
