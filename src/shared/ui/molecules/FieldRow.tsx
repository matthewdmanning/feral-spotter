/**
 * shared/ui/molecules/FieldRow.tsx
 * One read-only answer: a muted label on the left, its value on the right.
 * Submission Details and the Sighting view list a cat's answers this way.
 */

import { Text, View } from 'react-native'
import { styles } from './FieldRow.styles'

interface FieldRowProps {
  label: string
  value: string
}

export function FieldRow({ label, value }: FieldRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}
