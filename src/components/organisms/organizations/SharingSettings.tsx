import {
  organizationsCopy as copy,
  formatOrganizationCopy,
} from '@/src/lib/organizations/copy'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { GlassSurface } from '@/src/components/atoms/GlassSurface'
import { TextField } from '@/src/components/atoms/TextField'
import { AppButton } from '@/src/components/atoms/AppButton'
import { useAuth } from '@/src/lib/auth/useAuth'
import {
  useOrganizationSharingStore,
  EMPTY_ORGANIZATION_ACCOUNT,
} from '@/src/hooks/useOrganizationSharingStore'
import { useOrganizationsFlag } from '@/src/hooks/useOrganizationsFlag'
import type {
  SharingFields,
  SharingSettings as SharingConfiguration,
} from '@/src/types/Organizations'
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
  return (
    <SharingSettingsForm
      key={`${user.uid}:${JSON.stringify(saved)}`}
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
  const groups: {
    id: string
    label: string
    fields: (keyof SharingFields)[]
  }[] = [
    {
      id: 'sighting',
      label: copy.settings.sightingFields,
      fields: ['catDetails', 'preciseLocation', 'photos'],
    },
    {
      id: 'contact',
      label: copy.settings.contactFields,
      fields: ['name', 'email', 'phone'],
    },
  ]
  return (
    <GlassSurface
      kind="card"
      style={styles.card}
      testID="organization-sharing-settings"
    >
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.settings.title}
        </Text>
        <Text style={styles.hint}>{copy.settings.disclosure}</Text>
      </View>
      {groups.map((group) => (
        <View key={group.id} style={styles.group}>
          <Text accessibilityRole="header" style={styles.groupTitle}>
            {group.label}
          </Text>
          {group.fields.map((key) => (
            <View key={key} style={styles.group}>
              <SharingCheckbox
                label={copy.shareFields[key]}
                checked={draft.fields[key]}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    fields: { ...draft.fields, [key]: value },
                  })
                }
              />
              {draft.fields[key] && key === 'name' && (
                <View style={styles.fieldDetail}>
                  <TextField
                    label={copy.settings.name}
                    value={draft.name}
                    maxLength={200}
                    autoComplete="name"
                    autoCapitalize="words"
                    onChangeText={(name) => setDraft({ ...draft, name })}
                  />
                </View>
              )}
              {draft.fields[key] && key === 'email' && (
                <View style={styles.fieldDetail}>
                  <Text style={styles.hint}>
                    {formatOrganizationCopy(copy.settings.email, {
                      email: email ?? copy.settings.noEmail,
                    })}
                  </Text>
                </View>
              )}
              {draft.fields[key] && key === 'phone' && (
                <View style={styles.fieldDetail}>
                  <TextField
                    label={copy.settings.phone}
                    value={draft.phone}
                    maxLength={50}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    onChangeText={(phone) => setDraft({ ...draft, phone })}
                  />
                </View>
              )}
            </View>
          ))}
        </View>
      ))}
      <View style={styles.footer}>
        <AppButton
          onPress={() =>
            useOrganizationSharingStore.getState().configure(uid, draft)
          }
        >
          {copy.settings.save}
        </AppButton>
      </View>
    </GlassSurface>
  )
}
