import { Text } from '@/src/shared/ui/atoms/Text'
import { View } from 'react-native'
import { formatCopy, organizationCopy } from '@/src/shared/config/text'

import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { TextField } from '@/src/shared/ui/atoms/TextField'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import {
  useSharingSettingsFormViewModel,
  useSharingSettingsViewModel,
} from '@/src/features/organizations/viewmodels/useSharingSettingsViewModel'
import {
  SHARING_FIELD_KEYS,
  type SharingSettings as SharingConfiguration,
} from '@/src/shared/types/Organizations'
import { SharingCheckbox } from './SharingCheckbox'
import { styles } from './styles'

export function SharingSettings() {
  const model = useSharingSettingsViewModel()
  if (!model) return null
  return (
    <SharingSettingsForm
      key={model.uid}
      email={model.email}
      saved={model.saved}
      onSave={model.save}
    />
  )
}

function SharingSettingsForm({
  email,
  saved,
  onSave,
}: {
  email: string | null
  saved: SharingConfiguration
  onSave: (settings: SharingConfiguration) => void
}) {
  const { draft, setField, setName, setPhone } =
    useSharingSettingsFormViewModel(saved)
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
            onChange={(value) => setField(key, value)}
          />
          {key === 'name' && draft.fields.name && (
            <TextField
              label={organizationCopy.sharingSettings.nameField}
              value={draft.name}
              maxLength={200}
              autoComplete="name"
              onChangeText={setName}
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
              onChangeText={setPhone}
            />
          )}
        </View>
      ))}
      <AppButton onPress={() => onSave(draft)}>
        {organizationCopy.sharingSettings.save}
      </AppButton>
    </GlassSurface>
  )
}
