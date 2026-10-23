import { StyleSheet as RNStyleSheet } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  container: { gap: theme.spacing.sm },
  // Not shown while the label is commented out in the component.
  label: { ...theme.textVariants.heading, color: theme.colors.text },
  divider: {
    height: RNStyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
}))
