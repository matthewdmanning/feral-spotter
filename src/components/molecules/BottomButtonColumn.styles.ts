import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  container: { width: '100%' },
  btn:      { minHeight: 48, width: '100%', borderRadius: theme.radius.lg, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  label:    { fontSize: theme.typography.base, fontWeight: '600' },
}))
