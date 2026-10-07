import { Pressable, Text, View, ActivityIndicator } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './AppButton.styles'
import { tapHaptic } from '@/src/lib/haptics'
import type { ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

// compact: tighter side padding for rows that hold three buttons.
export type ButtonSize = 'circle' | 'compact'

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
  const { theme } = useUnistyles()
  const isDisabled = disabled || loading
  // Mirrors styles.label's per-variant color so the spinner reads as the
  // same "text" the button would otherwise show, rather than the OS's
  // theme-blind ActivityIndicator default (green on Android, gray on iOS).
  const spinnerColor =
    variant === 'primary'
      ? theme.colors.accentText
      : variant === 'danger'
        ? theme.colors.onDanger
        : variant === 'ghost'
          ? theme.colors.muted
          : theme.colors.onSecondary

  return (
    <Pressable
      onPress={onPress}
      onPressIn={tapHaptic}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.base,
        flex1 && styles.flex1,
        isDisabled && styles.disabled,
        variant !== 'ghost' && {
          // The bevel is a gradient inset over the face: it reads as height.
          experimental_backgroundImage: pressed
            ? `${theme.gradients.bevelPressed}, ${theme.gradients[`${variant}Pressed`]}`
            : `${theme.gradients.bevel}, ${theme.gradients[variant]}`,
        },
        pressed && styles.pressed,
        diameter != null && {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
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
