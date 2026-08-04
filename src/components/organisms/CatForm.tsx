import { View, Text, Pressable } from 'react-native'
import { SegmentedControl } from '@/src/components/atoms/SegmentedControl'
import { CatPhotoSelector } from '@/src/components/organisms/CatPhotoSelector'
import type { CatForm as CatFormValues } from '@/src/hooks/useCatForm'
import type { CatSubmitResult } from '@/src/hooks/useCatSubmit'
import type { ObservedCat } from '@/src/hooks/useSubmissionStore'
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
  existingCat?: ObservedCat
  annotationEnabled: boolean
}

export function CatForm({
  form,
  submit,
  existingCat,
  annotationEnabled,
}: CatFormProps) {
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

        <View style={styles.photoSection}>
          <Text style={styles.photoLabel}>Photos showing this cat</Text>
          <CatPhotoSelector
            catLocalId={existingCat?.local_id ?? ''}
            selectedPhotoIds={form.photoIds}
            onTogglePhoto={form.handleTogglePhoto}
            annotationEnabled={annotationEnabled}
            photosReviewed={existingCat?.photos_reviewed ?? false}
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
        </View>
      </View>
    </View>
  )
}
