import { Text } from '@/src/shared/ui/atoms/Text'
import { Pressable } from 'react-native'
import { CheckboxBox } from '@/src/shared/ui/atoms/CheckboxBox'
import { styles } from '@/src/features/organizations/components/styles'

/** One accessible checkbox target, with text that wraps at large font sizes. */
export function SharingCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Pressable
      style={styles.checkRow}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
    >
      <CheckboxBox checked={checked} />
      <Text style={styles.body}>{label}</Text>
    </Pressable>
  )
}
