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

interface SegmentedRowProps<T extends string | number> {
  options: Option<T>[]
  value: T | undefined
  onChange: (value: T | undefined) => void
  accessibilityLabel: string
  // Long labels ("Bicolor & Piebald") need a second line to stay readable.
  numberOfLines?: number
}

/** The track of options alone, for controls that stack more than one. */
export function SegmentedRow<T extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
  numberOfLines = 1,
}: SegmentedRowProps<T>) {
  return (
    <View style={styles.row} accessibilityLabel={accessibilityLabel}>
      {options.map((opt) => {
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
              numberOfLines={numberOfLines}
            >
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
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
      <SegmentedRow
        options={options}
        value={value}
        onChange={onChange}
        accessibilityLabel={accessibilityLabel ?? label}
      />
    </View>
  )
}
