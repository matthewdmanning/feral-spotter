import { Text } from '@/src/shared/ui/atoms/Text'
import { Pressable } from 'react-native'
import { CheckboxBox } from '@/src/shared/ui/atoms/CheckboxBox'
import { styles } from '@/src/features/organizations/components/styles'

/** One accessible checkbox target, with text that wraps at large font sizes. */
export function SharingCheckbox({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <Pressable
      style={styles.checkRow}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
    >
      <CheckboxBox checked={checked} />
      <Text style={styles.body}>{label}</Text>
    </Pressable>
  )
}
