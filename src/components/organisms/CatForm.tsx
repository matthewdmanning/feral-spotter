import { View, Text, Pressable } from 'react-native'
import { SegmentedControl } from '@/src/components/atoms/SegmentedControl'
import type { CatForm as CatFormValues } from '@/src/hooks/useCatForm'
import type { CatSubmitResult } from '@/src/hooks/useCatSubmit'
import {
  AGE_OPTIONS,
  EAR_TIPPED_OPTIONS,
  OWNED_OPTIONS,
  PATTERN_OPTIONS,
  HAIR_LENGTH_OPTIONS,
  SEX_OPTIONS,
  HEALTH_OPTIONS,
  colorOptionsForPattern,
} from '@/src/screens/submission/cats/constants'
import { styles } from './CatForm.styles'

interface CatFormProps {
  form: CatFormValues
  submit: CatSubmitResult
  /**
   * #299: present only when editing an already-saved cat. A cat that has
   * never been saved has nothing to remove — backing out of it is already
   * handled by useAbandonCatGuard (#304), which is a different action with
   * different copy.
   */
  onRemove?: () => void
}

export function CatForm({ form, submit, onRemove }: CatFormProps) {
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
          <SegmentedControl
            label="Pattern"
            options={PATTERN_OPTIONS}
            value={form.pattern}
            onChange={form.setPattern}
          />
          <SegmentedControl
            label="Color"
            options={colorOptionsForPattern(form.pattern)}
            value={form.color}
            onChange={form.setColor}
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

        <View style={styles.actions}>
          <Pressable
            onPress={submit.handleSave}
            style={styles.saveBtn}
            accessibilityRole="button"
          >
            <Text style={styles.saveBtnText}>{submit.saveLabel}</Text>
          </Pressable>
          {onRemove && (
            <Pressable
              onPress={onRemove}
              style={styles.removeBtn}
              accessibilityRole="button"
              accessibilityLabel="Remove this cat"
            >
              <Text style={styles.removeBtnText}>Remove this Cat</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  )
}
