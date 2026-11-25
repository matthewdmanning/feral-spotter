import { Pressable } from 'react-native'
import { CheckboxBox } from '@/src/shared/ui/atoms/CheckboxBox'
import { Text } from '@/src/shared/ui/atoms/Text'
import { styles } from './CheckboxRow.styles'

/** One accessible checkbox target, with a label that wraps at large font sizes. */
export function CheckboxRow({
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
      style={styles.row}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
    >
      <CheckboxBox checked={checked} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  )
}
