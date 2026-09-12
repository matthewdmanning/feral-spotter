import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  message: { color: theme.colors.text, fontSize: theme.typography.base },
  buttonRow: { flexDirection: 'row', gap: theme.spacing.sm },
  buttonColumn: { gap: theme.spacing.sm },
}))
