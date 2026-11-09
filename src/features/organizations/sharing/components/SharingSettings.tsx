import { useState } from 'react'
import { Text } from '@/src/shared/ui/atoms/Text'
import { View } from 'react-native'
import { formatCopy, organizationCopy } from '@/src/shared/config/text'

import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { TextField } from '@/src/shared/ui/atoms/TextField'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { useAuth } from '@/src/features/auth/lib/useAuth'
import {
  useOrganizationSharingStore,
  EMPTY_ORGANIZATION_ACCOUNT,
} from '@/src/features/organizations/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import {
  SHARING_FIELD_KEYS,
  type SharingSettings as SharingConfiguration,
} from '@/src/shared/types/Organizations'
import { SharingCheckbox } from './SharingCheckbox'
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
  const labels = organizationCopy.sharingSettings.shareFieldLabels
  return (
    <GlassSurface kind="card" style={styles.card}>
      <Text style={styles.title}>{organizationCopy.sharingSettings.title}</Text>
      <Text style={styles.body}>
        {organizationCopy.sharingSettings.description}
      </Text>
      <Text style={styles.hint}>
        {organizationCopy.sharingSettings.includedNotice}
      </Text>
      {SHARING_FIELD_KEYS.map((key) => (
        <View key={key} style={styles.fieldGroup}>
          <SharingCheckbox
            label={labels[key]}
            checked={draft.fields[key]}
            onChange={(value) =>
              setDraft({ ...draft, fields: { ...draft.fields, [key]: value } })
            }
          />
          {key === 'name' && draft.fields.name && (
            <TextField
              label={organizationCopy.sharingSettings.nameField}
              value={draft.name}
              maxLength={200}
              autoComplete="name"
              onChangeText={(name) => setDraft({ ...draft, name })}
            />
          )}
          {key === 'email' && draft.fields.email && (
            <Text style={styles.body}>
              {formatCopy(organizationCopy.sharingSettings.emailValue, {
                email:
                  email ?? organizationCopy.sharingSettings.emailUnavailable,
              })}
            </Text>
          )}
          {key === 'phone' && draft.fields.phone && (
            <TextField
              label={organizationCopy.sharingSettings.phoneField}
              value={draft.phone}
              maxLength={50}
              keyboardType="phone-pad"
              autoComplete="tel"
              onChangeText={(phone) => setDraft({ ...draft, phone })}
            />
          )}
        </View>
      ))}
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
