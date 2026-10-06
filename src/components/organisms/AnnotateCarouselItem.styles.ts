import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  photoLayer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  box: {
    borderWidth: 1.5,
    borderColor: theme.colors.text,
    position: 'absolute',
  },
  crosshairLine: {
    backgroundColor: theme.colors.text,
    opacity: 0.6,
    position: 'absolute',
  },
  dotTouchArea: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent,
  },
  handleTouchArea: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleBar: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.full,
  },
  handleBarVertical: { width: 4, height: 20 },
  handleBarHorizontal: { width: 20, height: 4 },
  confirmBtn: {
    position: 'absolute',
    bottom: theme.spacing.xxl,
    alignSelf: 'center',
    minHeight: theme.controlHeight.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent,
    ...theme.elevation.raised,
  },
  confirmText: {
    ...theme.textVariants.labelSmall,
    color: theme.colors.accentText,
  },
}))
