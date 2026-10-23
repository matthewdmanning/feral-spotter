import { Pressable, Switch, Text, View } from 'react-native'
import { withUnistyles } from 'react-native-unistyles'
import { styles } from './ToggleRow.styles'

const UniSwitch = withUnistyles(Switch, (theme) => ({
  trackColor: { false: theme.colors.border, true: theme.colors.accent },
  thumbColor: theme.colors.text,
}))

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
        <UniSwitch value={value} onValueChange={onValueChange} />
      </Pressable>
    </View>
  )
}
