import type { ReactNode } from 'react'
import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native'
import { styles } from './TextButton.styles'

export type TextButtonTone = 'accent' | 'muted' | 'danger'

interface TextButtonProps {
  onPress: () => void
  children: string
  tone?: TextButtonTone
  /** Drawn before the label, for an icon row such as a settings link. */
  icon?: ReactNode
  underline?: boolean
  disabled?: boolean
  /** 'link' for navigation to another screen; 'button' for an action. */
  accessibilityRole?: 'button' | 'link'
  accessibilityLabel?: string
  /** Placement only (position, alignSelf, margins). Appearance is fixed. */
  style?: StyleProp<ViewStyle>
}

/**
 * A text-only action for the places a filled AppButton is too heavy: Skip,
 * Clear, Decline, in-line links, and settings rows.
 */
export function TextButton({
  onPress,
  children,
  tone = 'accent',
  icon,
  underline = false,
  disabled = false,
  accessibilityRole = 'button',
  accessibilityLabel,
  style,
}: TextButtonProps) {
  styles.useVariants({ tone, underline })
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityState={{ disabled }}
      style={[styles.base, disabled && styles.disabled, style]}
    >
      {icon}
      <Text style={styles.label}>{children}</Text>
    </Pressable>
  )
}
