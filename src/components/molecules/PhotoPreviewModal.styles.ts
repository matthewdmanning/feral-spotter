import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme, rt) => ({
  backdrop:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  closeBtn:          { position: 'absolute', right: 16, top: rt.insets.top + 12, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  imageWrap:         { width: '100%', height: '75%' },
  actions:           { position: 'absolute', left: 16, right: 16, bottom: rt.insets.bottom + 24 },
  toggleBtn:         { paddingVertical: 16, borderRadius: theme.radius.lg, alignItems: 'center' },
  toggleAdd:         { backgroundColor: theme.colors.accent },
  toggleRemove:      { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border },
  toggleTextAdd:     { fontSize: 15, fontWeight: '600', color: theme.colors.accentText },
  toggleTextRemove:  { fontSize: 15, fontWeight: '600', color: theme.colors.text },
}))
