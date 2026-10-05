import { StyleSheet } from 'react-native-unistyles'
import { THUMB_SIZE } from './CameraThumb.constants'

// Drawn over the live camera feed, so colors come from the onCamera tokens —
// the theme's text color would turn dark-on-dark in light mode.
export const styles = StyleSheet.create((theme) => ({
  wrap: { position: 'relative' },
  image: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.onCameraBorder,
  },
  badge: {
    position: 'absolute',
    bottom: theme.spacing.xs,
    right: theme.spacing.xs,
    minWidth: theme.spacing.xl,
    alignItems: 'center',
    backgroundColor: theme.colors.onCameraScrim,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.xs + 2,
    paddingVertical: 2,
  },
  badgeText: {
    ...theme.textVariants.caption,
    color: theme.colors.onCamera,
    fontWeight: '700',
  },
}))
