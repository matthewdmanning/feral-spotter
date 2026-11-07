import { View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { CheckIcon } from 'phosphor-react-native/src/icons/Check'
import { styles } from './CheckboxBox.styles'

/** The visual box of a checkbox. The pressable row owns role, label and state. */
export function CheckboxBox({ checked }: { checked: boolean }) {
  const { theme } = useUnistyles()
  return (
    <View style={[styles.box, checked && styles.checked]}>
      {checked && (
        <CheckIcon size={theme.iconSize.sm} color={theme.colors.accentText} />
      )}
    </View>
  )
}
