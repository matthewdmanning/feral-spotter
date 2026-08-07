import { CatForm } from '@/src/components/organisms/CatForm'
import {
  DEFAULT_DIAMETER,
  InsetCropBubble,
} from '@/src/components/organisms/InsetCropBubble'
import { useSubmissionStore } from '@/src/hooks'
import { useActiveCatFlow } from '@/src/hooks/useActiveCatFlow'
import { useCatForm } from '@/src/hooks/useCatForm'
import { useCatSubmit } from '@/src/hooks/useCatSubmit'
import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

export default function CatObservationScreen() {
  const { theme } = useUnistyles()
  const { edit: editId } = useLocalSearchParams<{ edit?: string }>()

  const cats = useSubmissionStore((s) => s.cats)
  const existingCat = editId
    ? cats.find((c) => c.local_id === editId)
    : undefined
  const annotationEnabled = useSettingsStore(
    (s) => s.settings.annotation_enabled,
  )
  const { activeCatId } = useActiveCatFlow()

  const form = useCatForm(existingCat)
  const submit = useCatSubmit({ form, existingCat, annotationEnabled })
  const catId = existingCat?.local_id ?? activeCatId

  // Header-zone reserves height = the bubble's own computed diameter
  // (#174) so the bubble is structurally confined to the title row and
  // can never overlap a form field below it, regardless of its size.
  // Starts at the bubble's own pre-report default (not 0) so the
  // guarantee holds on the first frame too, before onDiameterChange fires.
  const [bubbleDiameter, setBubbleDiameter] = useState(DEFAULT_DIAMETER)

  return (
    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.inner}>
        <View
          testID="cat-form-header-zone"
          style={[
            styles.headerZone,
            catId ? { minHeight: bubbleDiameter } : null,
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, catId ? styles.titleFaded : null]}>
              {existingCat ? 'Edit Cat' : 'Observed Cat'}
            </Text>
            <View style={styles.headerActions}>
              <Pressable
                onPress={form.handleClear}
                style={styles.headerBtn}
                accessibilityRole="button"
              >
                <Text
                  style={[styles.headerBtnText, { color: theme.colors.danger }]}
                >
                  Clear
                </Text>
              </Pressable>
            </View>
          </View>
          {catId && (
            <InsetCropBubble
              catId={catId}
              edge="top-center"
              onDiameterChange={setBubbleDiameter}
            />
          )}
        </View>
        <CatForm form={form} submit={submit} />
      </View>
    </ScrollView>
  )
}
