import { Text, TextInput, View, type TextInputProps } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './TextField.styles'

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  /** A visible label above the field. Without one, pass accessibilityLabel. */
  label?: string
}

/** The app's one text input. Appearance is fixed; behavior props pass through. */
export function TextField({ label, ...inputProps }: TextFieldProps) {
  const { theme } = useUnistyles()
  const input = (
    <TextInput
      autoCapitalize="none"
      placeholderTextColor={theme.colors.muted}
      accessibilityLabel={label}
      {...inputProps}
      style={styles.input}
    />
  )
  if (!label) return input
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      {input}
    </View>
  )
}
