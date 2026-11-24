import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { View } from 'react-native'
import { HierarchicalSegmentedControl } from '@/src/shared/ui/atoms/HierarchicalSegmentedControl'
import { SegmentedControl } from '@/src/shared/ui/atoms/SegmentedControl'
import type {
  CatForm as CatFormState,
  CatFormValues,
} from '@/src/features/draft-submission/hooks/useCatForm'
import {
  CAT_ATTRIBUTES,
  COAT_GROUPS,
  shownCoatValue,
} from '@/src/features/draft-submission/lib/attributes'
import { submissionCopy } from '@/src/shared/config/text'
import { styles } from './CatForm.styles'

/** The coat pair (pattern + color) is one two-level control. */
const COAT = 'coat'
type SectionItem = Exclude<keyof CatFormValues, 'pattern' | 'color'> | 'coat'

/** Layout only; labels and options come from CAT_ATTRIBUTES. */
const SECTIONS: SectionItem[][] = [
  ['age', 'sex', 'earTipped'],
  ['hairLength', COAT],
  ['owned', 'healthLabel'],
]

const ACCESSIBILITY_LABELS: Partial<Record<SectionItem, string>> = {
  healthLabel: submissionCopy.cat.healthAccessibility,
}

function AttributeControl({
  form,
  field,
}: {
  form: CatFormState
  field: Exclude<SectionItem, 'coat'>
}) {
  const attribute = CAT_ATTRIBUTES.find((a) => a.key === field)
  if (!attribute) return null
  return (
    <SegmentedControl<string>
      label={attribute.label}
      options={[...attribute.options]}
      value={form[field]}
      onChange={(value) =>
        form.setField(field, value as CatFormValues[typeof field])
      }
      accessibilityLabel={ACCESSIBILITY_LABELS[field]}
    />
  )
}

interface CatFormProps {
  form: CatFormState
}

export function CatForm({ form }: CatFormProps) {
  return (
    <GlassSurface kind="card" style={styles.card}>
      <View style={styles.inner}>
        {SECTIONS.map((section) => (
          <View key={section.join()} style={styles.section}>
            {section.map((item) =>
              item === COAT ? (
                <HierarchicalSegmentedControl
                  key={item}
                  label={submissionCopy.cat.coat}
                  groups={COAT_GROUPS}
                  group={shownCoatValue(form.pattern)}
                  value={shownCoatValue(form.color)}
                  onChange={(pattern, color) => {
                    form.setField('pattern', pattern)
                    form.setField('color', color)
                  }}
                />
              ) : (
                <AttributeControl key={item} form={form} field={item} />
              ),
            )}
          </View>
        ))}
      </View>
    </GlassSurface>
  )
}
