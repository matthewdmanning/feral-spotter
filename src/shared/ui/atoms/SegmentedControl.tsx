import { useState } from 'react'
import { useUnistyles } from 'react-native-unistyles'
import { MAX_FONT_SIZE_MULTIPLIER } from '@/src/shared/config/text'
import { Text } from '@/src/shared/ui/atoms/Text'
import { View, Pressable, useWindowDimensions } from 'react-native'
import { styles } from './SegmentedControl.styles'
import { selectionHaptic } from '@/src/shared/lib/haptics'

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
  /**
   * A choice is always held: tapping the selected option does nothing, so
   * `onChange` never receives undefined. Off by default, where tapping the
   * selected option clears it (a cat attribute left unset).
   */
  required?: boolean
}

interface SegmentedRowProps<T extends string | number> {
  options: Option<T>[]
  value: T | undefined
  onChange: (value: T | undefined) => void
  accessibilityLabel: string
  /** See SegmentedControlProps.required. */
  required?: boolean
}

/** The track of options alone, for controls that stack more than one. */
export function SegmentedRow<T extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
  required = false,
}: SegmentedRowProps<T>) {
  const { theme } = useUnistyles()
  const { width, fontScale } = useWindowDimensions()
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null)
  const availableWidth =
    (measuredWidth ??
      width - 2 * theme.layout.gutter - 2 * theme.layout.cardPadding) -
    2 * theme.spacing.xs -
    2
  const optionWidth = Math.min(
    Math.max(0, availableWidth),
    theme.controlWidth.choice * Math.min(fontScale, MAX_FONT_SIZE_MULTIPLIER),
  )
  return (
    <View
      style={styles.row}
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
    >
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <Pressable
            key={String(opt.value)}
            onPressIn={selectionHaptic}
            onPress={() => {
              if (selected && required) return
              onChange(selected ? undefined : opt.value)
            }}
            style={({ pressed }) => [
              styles.option,
              { flexBasis: optionWidth },
              selected ? styles.optionSelected : styles.optionIdle,
              pressed && styles.optionPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
          >
            <Text style={selected ? styles.textSelected : styles.textIdle}>
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
  required,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <SegmentedRow
        options={options}
        value={value}
        onChange={onChange}
        accessibilityLabel={accessibilityLabel ?? label}
        required={required}
      />
    </View>
  )
}
