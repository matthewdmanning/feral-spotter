import { StyleSheet as RNStyleSheet } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  container: { gap: theme.spacing.sm },
  divider: {
    height: RNStyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
}))
