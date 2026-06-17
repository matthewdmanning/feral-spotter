import { Pressable, Text, View, ActivityIndicator } from 'react-native'
import { styles } from './AppButton.styles'
import type { ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export interface ColumnButton {
  key: string; label: string; onPress: () => void
  variant?: ButtonVariant; disabled?: boolean; accessibilityLabel?: string
}

interface AppButtonProps {
  onPress: () => void; children: string
  variant?: ButtonVariant; disabled?: boolean; loading?: boolean
  icon?: ReactNode; iconAfter?: ReactNode; accessibilityLabel?: string; flex1?: boolean
}

export function AppButton({
  onPress, children, variant = 'primary',
  disabled = false, loading = false,
  icon, iconAfter, accessibilityLabel, flex1 = false,
}: AppButtonProps) {
  styles.useVariants({ variant })
  const isDisabled = disabled || loading

  return (
    <Pressable
      onPress={onPress} disabled={isDisabled}
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={[styles.base, flex1 && styles.flex1, isDisabled && styles.disabled]}
    >
      {loading
        ? <ActivityIndicator size="small" />
        : <>
            {icon && <View>{icon}</View>}
            <Text style={styles.label}>{children}</Text>
            {iconAfter && <View>{iconAfter}</View>}
          </>
      }
    </Pressable>
  )
}
