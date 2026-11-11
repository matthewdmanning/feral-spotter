import { Text } from '@/src/shared/ui/atoms/Text'
import { TextInput, View, type TextInputProps } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { MAX_FONT_SIZE_MULTIPLIER } from '@/src/shared/config/text'
import { useState } from 'react'
import { styles } from './TextField.styles'

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  /** A visible label above the field. Without one, pass accessibilityLabel. */
  label?: string
}

/** The app's one text input. Appearance is fixed; behavior props pass through. */
export function TextField({ label, ...inputProps }: TextFieldProps) {
  const [focused, setFocused] = useState(false)
  const { theme } = useUnistyles()
  const input = (
    <TextInput
      autoCapitalize="none"
      placeholderTextColor={theme.colors.muted}
      accessibilityLabel={label}
      {...inputProps}
      allowFontScaling
      maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
      onFocus={(event) => {
        setFocused(true)
        inputProps.onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        inputProps.onBlur?.(event)
      }}
      style={[styles.input, focused && styles.focused]}
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
