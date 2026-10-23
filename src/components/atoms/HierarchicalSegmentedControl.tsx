import { View } from 'react-native'
import { SegmentedRow } from '@/src/components/atoms/SegmentedControl'
import { styles } from './HierarchicalSegmentedControl.styles'

interface Option<T extends string> {
  value: T
  label: string
}

interface Group<G extends string, C extends string> extends Option<G> {
  children: Option<C>[]
}

interface HierarchicalSegmentedControlProps<
  G extends string,
  C extends string,
> {
  label: string
  groups: Group<G, C>[]
  group: G | undefined
  value: C | undefined
  onChange: (group: G | undefined, value: C | undefined) => void
}

/**
 * Two stacked tracks: the group, then the choices inside the chosen group. A
 * thin divider sits between them. Choosing another group drops a choice that
 * belongs to the old one; tapping the chosen group again clears both.
 */
export function HierarchicalSegmentedControl<
  G extends string,
  C extends string,
>({
  label,
  groups,
  group,
  value,
  onChange,
}: HierarchicalSegmentedControlProps<G, C>) {
  const chosen = groups.find((g) => g.value === group)
  return (
    <View style={styles.container}>
      {/* <Text style={styles.label}>{label}</Text> */}
      <SegmentedRow
        options={groups}
        value={group}
        onChange={(next) => onChange(next, undefined)}
        accessibilityLabel={label}
        numberOfLines={2}
      />
      {chosen && (
        <>
          <View style={styles.divider} />
          <SegmentedRow
            options={chosen.children}
            value={value}
            onChange={(next) => onChange(group, next)}
            accessibilityLabel={`${label} — ${chosen.label}`}
            numberOfLines={2}
          />
        </>
      )}
    </View>
  )
}
