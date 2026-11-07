import { Pressable, Text, View } from 'react-native'
import { styles } from './styles'

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
      <View style={[styles.checkbox, checked && styles.checked]}>
        <Text style={styles.mark}>{checked ? '✓' : ''}</Text>
      </View>
      <Text style={styles.body}>{label}</Text>
    </Pressable>
  )
}
