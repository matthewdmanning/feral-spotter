import { View, Text, Pressable } from 'react-native'
import { useStyles } from 'react-native-unistyles'
import { stylesheet } from './SegmentedControl.styles'

interface Option<T extends string | number> {
  value: T; label: string
}

interface SegmentedControlProps<T extends string | number> {
  label: string; options: Option<T>[]; value: T
  onChange: (value: T) => void; accessibilityLabel?: string
}

export function SegmentedControl<T extends string | number>({
  label, options, value, onChange, accessibilityLabel,
}: SegmentedControlProps<T>) {
  const { styles } = useStyles(stylesheet)

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row} accessibilityLabel={accessibilityLabel ?? label} accessibilityRole="radiogroup">
        {options.map((opt, i) => {
          const selected = opt.value === value
          const isLast   = i === options.length - 1
          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => onChange(opt.value)}
              style={[
                styles.option,
                selected ? styles.optionSelected : styles.optionIdle,
                !isLast && styles.optionBorder,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={opt.label}
            >
              <Text style={selected ? styles.textSelected : styles.textIdle} numberOfLines={1}>
                {opt.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
