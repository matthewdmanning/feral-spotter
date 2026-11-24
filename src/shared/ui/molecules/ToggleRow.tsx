import type { UnistylesThemes } from 'react-native-unistyles'
import { Text } from '@/src/shared/ui/atoms/Text'
import { Pressable, Switch, View } from 'react-native'
import { withUnistyles } from 'react-native-unistyles'
import { styles } from './ToggleRow.styles'

const UniSwitch = withUnistyles(Switch)

/**
 * Track and thumb colors for each state (STYLE-1). The off track is a control
 * edge (`borderStrong`, 3:1+ on cards); each thumb is the foreground of its
 * track, so the thumb stays visible on and off in both themes.
 */
export function switchColors(
  theme: UnistylesThemes[keyof UnistylesThemes],
  value: boolean,
) {
  return {
    trackColor: {
      false: theme.colors.borderStrong,
      true: theme.colors.accent,
    },
    thumbColor: value ? theme.colors.accentText : theme.colors.surface,
  }
}

interface ToggleRowProps {
  label: string
  hint?: string
  value: boolean
  onValueChange: (value: boolean) => void
}

/** A labelled on/off setting. The whole switch area is one 48dp target. */
export function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
}: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.textGroup}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Pressable
        onPress={() => onValueChange(!value)}
        style={styles.switchTarget}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value }}
      >
        <UniSwitch
          value={value}
          onValueChange={onValueChange}
          uniProps={(theme) => switchColors(theme, value)}
        />
      </Pressable>
    </View>
  )
}
