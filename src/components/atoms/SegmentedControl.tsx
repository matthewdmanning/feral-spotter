import { View, Text, Pressable } from 'react-native'
import { styles } from './SegmentedControl.styles'
import { selectionHaptic } from '@/src/lib/haptics'

interface Option<T extends string | number> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string | number> {
  label: string
  options: Option<T>[]
  value: T | undefined
  onChange: (value: T | undefined) => void
  accessibilityLabel?: string
}

export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row} accessibilityLabel={accessibilityLabel ?? label}>
        {options.map((opt, i) => {
          const selected = opt.value === value
          return (
            <Pressable
              key={String(opt.value)}
              onPressIn={selectionHaptic}
              onPress={() => onChange(selected ? undefined : opt.value)}
              style={({ pressed }) => [
                styles.option,
                selected ? styles.optionSelected : styles.optionIdle,
                pressed && styles.optionPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={opt.label}
            >
              <Text
                style={selected ? styles.textSelected : styles.textIdle}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
