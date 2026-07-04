import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  photoLayer:    { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  square:        { borderWidth: 1.5, borderColor: theme.colors.text, position: 'absolute' },
  crosshairLine: { backgroundColor: theme.colors.text, opacity: 0.6, position: 'absolute' },
  dotTouchArea:  { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  dot:           { width: 14, height: 14, borderRadius: theme.radius.full, backgroundColor: theme.colors.accent },
  confirmBtn:    { position: 'absolute', bottom: 24, alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: theme.radius.md, backgroundColor: theme.colors.accent },
  confirmText:   { color: theme.colors.accentText, fontSize: theme.typography.sm, fontWeight: '600' },
}))
