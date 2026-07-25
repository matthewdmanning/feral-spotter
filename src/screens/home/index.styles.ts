import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  root:         { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.lg },
  cameraArea:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cameraBtn:    { width: 160, height: 160, borderRadius: 80, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  headerIcon:   { marginRight: 4 },
}))
