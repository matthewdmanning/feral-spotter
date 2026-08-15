import { Pressable, Text, View, ActivityIndicator } from 'react-native'
import { styles } from './AppButton.styles'
import type { ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export type ButtonSize = 'circle'

export interface ColumnButton {
  key: string
  label: string
  onPress: () => void
  variant?: ButtonVariant
  disabled?: boolean
  accessibilityLabel?: string
}

interface AppButtonProps {
  onPress: () => void
  children: string
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  icon?: ReactNode
  iconAfter?: ReactNode
  accessibilityLabel?: string
  flex1?: boolean
  /** Fixed diameter (dp) for size="circle" — screen-dependent, so it's computed by the caller, not a style variant. */
  diameter?: number
}

export function AppButton({
  onPress,
  children,
  variant = 'primary',
  size,
  disabled = false,
  loading = false,
  icon,
  iconAfter,
  accessibilityLabel,
  flex1 = false,
  diameter,
}: AppButtonProps) {
  styles.useVariants({ variant, size })
  const isDisabled = disabled || loading

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={[
        styles.base,
        flex1 && styles.flex1,
        isDisabled && styles.disabled,
        diameter != null && {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" />
      ) : (
        <>
          {icon && <View>{icon}</View>}
          <Text style={styles.label}>{children}</Text>
          {iconAfter && <View>{iconAfter}</View>}
        </>
      )}
    </Pressable>
  )
}
