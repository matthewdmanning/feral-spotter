import { fieldSurface } from '@/src/shared/ui/atoms/TextField.styles'
import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  container: { gap: theme.spacing.sm },
  label: { ...theme.textVariants.labelSmall, color: theme.colors.muted },
  trigger: {
    ...fieldSurface(theme),
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  triggerText: { ...theme.textVariants.body, color: theme.colors.text },
  stepRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'center',
  },
}))
