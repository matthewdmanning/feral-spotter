import { View } from 'react-native'
import { HierarchicalSegmentedControl } from '@/src/components/atoms/HierarchicalSegmentedControl'
import { SegmentedControl } from '@/src/components/atoms/SegmentedControl'
import type { CatForm as CatFormValues } from '@/src/hooks/useCatForm'
import {
  AGE_OPTIONS,
  EAR_TIPPED_OPTIONS,
  OWNED_OPTIONS,
  HAIR_LENGTH_OPTIONS,
  SEX_OPTIONS,
  HEALTH_OPTIONS,
  COAT_GROUPS,
} from '@/src/screens/submission/cats/constants'
import { styles } from './CatForm.styles'

interface CatFormProps {
  form: CatFormValues
}

export function CatForm({ form }: CatFormProps) {
  return (
    <View style={styles.card}>
      <View style={styles.inner}>
        <View style={styles.section}>
          <SegmentedControl
            label="Age"
            options={AGE_OPTIONS}
            value={form.age}
            onChange={form.setAge}
          />
          <SegmentedControl
            label="Sex"
            options={SEX_OPTIONS}
            value={form.sex}
            onChange={form.setSex}
          />
          <SegmentedControl
            label="Ear Tipped"
            options={EAR_TIPPED_OPTIONS}
            value={form.earTipped}
            onChange={form.setEarTipped}
          />
        </View>

        <View style={styles.section}>
          <SegmentedControl
            label="Hair Length"
            options={HAIR_LENGTH_OPTIONS}
            value={form.hairLength}
            onChange={form.setHairLength}
          />
          <HierarchicalSegmentedControl
            label="Coat and color"
            groups={COAT_GROUPS.map((g) => ({ ...g, children: g.colors }))}
            group={form.pattern === 'unknown' ? undefined : form.pattern}
            value={form.color === 'unknown' ? undefined : form.color}
            onChange={(pattern, color) => {
              form.setPattern(pattern)
              form.setColor(color)
            }}
          />
        </View>

        <View style={styles.section}>
          <SegmentedControl
            label="Owned / Domesticated"
            options={OWNED_OPTIONS}
            value={form.owned}
            onChange={form.setOwned}
          />
          <SegmentedControl
            label="Health"
            options={HEALTH_OPTIONS}
            value={form.healthLabel}
            onChange={form.setHealthLabel}
            accessibilityLabel="Cat health rating"
          />
        </View>
      </View>
    </View>
  )
}
