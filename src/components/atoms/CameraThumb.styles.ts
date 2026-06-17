import { StyleSheet } from 'react-native-unistyles'

export const stylesheet = StyleSheet.create((theme) => ({
  wrap:      { position: 'relative' },
  image:     { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: theme.radius.md, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  badge:     { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: theme.radius.sm, paddingHorizontal: 5, paddingVertical: 2 },
  badgeText: { color: theme.colors.text, fontSize: theme.typography.xs, fontWeight: '700' },
}))
