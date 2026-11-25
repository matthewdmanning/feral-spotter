/**
 * The per-field sharing choices: one checkbox per field, with the contact
 * value it reveals directly beneath it. Used by Settings and by the
 * keep-sharing choice when leaving an organization.
 */

import { View } from 'react-native'
import { Text } from '@/src/shared/ui/atoms/Text'
import { TextField } from '@/src/shared/ui/atoms/TextField'
import { formatCopy, organizationCopy } from '@/src/shared/config/text'
import {
  SHARING_FIELD_KEYS,
  SHARING_NAME_MAX_LENGTH,
  SHARING_PHONE_MAX_LENGTH,
  type SharingSettings,
} from '@/src/shared/types/Organizations'
import { styles } from '@/src/features/organizations/components/styles'
import { CheckboxRow } from '@/src/shared/ui/molecules/CheckboxRow'

export function SharingFieldInputs({
  settings,
  email,
  onChange,
  disabled = false,
  hideContact = false,
}: {
  settings: SharingSettings
  email: string | null | undefined
  onChange: (settings: SharingSettings) => void
  disabled?: boolean
  /** Anonymous: the contact values are not shared, so their inputs hide. */
  hideContact?: boolean
}) {
  const copy = organizationCopy.sharingSettings
  const showContact = (key: 'name' | 'email' | 'phone') =>
    !hideContact && settings.fields[key]
  return (
    <>
      {SHARING_FIELD_KEYS.map((key) => (
        <View key={key} style={styles.fieldGroup}>
          <CheckboxRow
            label={copy.shareFieldLabels[key]}
            checked={settings.fields[key]}
            disabled={disabled}
            onChange={(value) =>
              onChange({
                ...settings,
                fields: { ...settings.fields, [key]: value },
              })
            }
          />
          {key === 'name' && showContact('name') && (
            <TextField
              label={copy.nameField}
              value={settings.name}
              maxLength={SHARING_NAME_MAX_LENGTH}
              editable={!disabled}
              autoComplete="name"
              onChangeText={(name) => onChange({ ...settings, name })}
            />
          )}
          {key === 'email' && showContact('email') && (
            <Text style={styles.body}>
              {formatCopy(copy.emailValue, {
                email: email ?? copy.emailUnavailable,
              })}
            </Text>
          )}
          {key === 'phone' && showContact('phone') && (
            <TextField
              label={copy.phoneField}
              value={settings.phone}
              maxLength={SHARING_PHONE_MAX_LENGTH}
              editable={!disabled}
              keyboardType="phone-pad"
              autoComplete="tel"
              onChangeText={(phone) => onChange({ ...settings, phone })}
            />
          )}
        </View>
      ))}
    </>
  )
}
