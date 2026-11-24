import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { View } from 'react-native'
import { HierarchicalSegmentedControl } from '@/src/shared/ui/atoms/HierarchicalSegmentedControl'
import { SegmentedControl } from '@/src/shared/ui/atoms/SegmentedControl'
import type { CatForm as CatFormValues } from '@/src/features/draft-submission/hooks/useCatForm'
import {
  AGE_OPTIONS,
  EAR_TIPPED_OPTIONS,
  OWNED_OPTIONS,
  HAIR_LENGTH_OPTIONS,
  SEX_OPTIONS,
  HEALTH_OPTIONS,
  COAT_GROUPS,
  shownCoatValue,
} from '@/src/features/draft-submission/lib/formOptions'
import { FIELD_LABELS } from '@/src/features/draft-submission/lib/attributes'
import { submissionCopy } from '@/src/shared/config/text'
import { styles } from './CatForm.styles'

interface CatFormProps {
  form: CatFormValues
}

export function CatForm({ form }: CatFormProps) {
  return (
    <GlassSurface kind="card" style={styles.card}>
      <View style={styles.inner}>
        <View style={styles.section}>
          <SegmentedControl
            label={FIELD_LABELS.age}
            options={AGE_OPTIONS}
            value={form.age}
            onChange={form.setAge}
          />
          <SegmentedControl
            label={FIELD_LABELS.sex}
            options={SEX_OPTIONS}
            value={form.sex}
            onChange={form.setSex}
          />
          <SegmentedControl
            label={FIELD_LABELS.earTipped}
            options={EAR_TIPPED_OPTIONS}
            value={form.earTipped}
            onChange={form.setEarTipped}
          />
        </View>

        <View style={styles.section}>
          <SegmentedControl
            label={FIELD_LABELS.hairLength}
            options={HAIR_LENGTH_OPTIONS}
            value={form.hairLength}
            onChange={form.setHairLength}
          />
          <HierarchicalSegmentedControl
            label={submissionCopy.cat.coat}
            groups={COAT_GROUPS}
            group={shownCoatValue(form.pattern)}
            value={shownCoatValue(form.color)}
            onChange={(pattern, color) => {
              form.setPattern(pattern)
              form.setColor(color)
            }}
          />
        </View>

        <View style={styles.section}>
          <SegmentedControl
            label={FIELD_LABELS.owned}
            options={OWNED_OPTIONS}
            value={form.owned}
            onChange={form.setOwned}
          />
          <SegmentedControl
            label={FIELD_LABELS.healthLabel}
            options={HEALTH_OPTIONS}
            value={form.healthLabel}
            onChange={form.setHealthLabel}
            accessibilityLabel={submissionCopy.cat.healthAccessibility}
          />
        </View>
      </View>
    </GlassSurface>
  )
}
