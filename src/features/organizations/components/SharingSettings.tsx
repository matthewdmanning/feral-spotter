import { useState } from 'react'
import { Text } from 'react-native'
import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { TextField } from '@/src/shared/ui/atoms/TextField'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { useAuth } from '@/src/features/auth/lib/useAuth'
import {
  useOrganizationSharingStore,
  EMPTY_ORGANIZATION_ACCOUNT,
} from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { FIELD_LABELS } from '@/src/features/organizations/lib/sharing'
import {
  SHARING_FIELD_KEYS,
  type SharingSettings as SharingConfiguration,
} from '@/src/shared/types/Organizations'
import { SharingCheckbox } from './SharingCheckbox'
import { styles } from './styles'

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
      <Text style={styles.title}>Organization sharing</Text>
      <Text style={styles.body}>
        Choose what to offer every organization you select. Each sighting still
        needs your confirmation.
      </Text>
      <Text style={styles.hint}>
        Cat count and an approximate area are always included when you share.
        Anonymous is checked by default on each sighting and overrides name,
        email, and phone.
      </Text>
      {SHARING_FIELD_KEYS.map((key) => (
        <SharingCheckbox
          key={key}
          label={`Share ${FIELD_LABELS[key].toLowerCase()}`}
          checked={draft.fields[key]}
          onChange={(value) =>
            setDraft({ ...draft, fields: { ...draft.fields, [key]: value } })
          }
        />
      ))}
      {draft.fields.name && (
        <TextField
          label="Name to share"
          value={draft.name}
          maxLength={200}
          autoComplete="name"
          onChangeText={(name) => setDraft({ ...draft, name })}
        />
      )}
      {draft.fields.email && (
        <Text style={styles.body}>
          Email to share: {email ?? 'No email available'}
        </Text>
      )}
      {draft.fields.phone && (
        <TextField
          label="Phone to share"
          value={draft.phone}
          maxLength={50}
          keyboardType="phone-pad"
          autoComplete="tel"
          onChangeText={(phone) => setDraft({ ...draft, phone })}
        />
      )}
      <AppButton
        onPress={() =>
          useOrganizationSharingStore.getState().configure(uid, draft)
        }
      >
        Save sharing preferences
      </AppButton>
    </GlassSurface>
  )
}
