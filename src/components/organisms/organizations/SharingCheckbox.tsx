import { Pressable, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { CheckIcon } from 'phosphor-react-native/src/icons/Check'
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
  const { theme } = useUnistyles()
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
        {checked && (
          <CheckIcon
            size={theme.iconSize.sm}
            color={theme.colors.accentText}
            weight="bold"
          />
        )}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  )
}
