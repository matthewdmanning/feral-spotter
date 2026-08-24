import { CatForm } from '@/src/components/organisms/CatForm'
import {
  COLLAPSED_DIAMETER,
  DEFAULT_DIAMETER,
  InsetCropBubble,
} from '@/src/components/organisms/InsetCropBubble'
import { useSubmissionStore } from '@/src/hooks'
import { useAbandonCatGuard } from '@/src/hooks/useAbandonCatGuard'
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

  // Backing out of an unsaved cat would otherwise leave it in progress, and
  // the next "Add a Cat" would silently resume it (#304).
  useAbandonCatGuard(Boolean(existingCat))

  // Header-zone reserves height = the bubble's own computed diameter
  // (#174) so the bubble is structurally confined to the title row and
  // can never overlap a form field below it, regardless of its size.
  // Starts at the bubble's own pre-report default (not 0) so the
  // guarantee holds on the first frame too, before onDiameterChange fires.
  const [bubbleDiameter, setBubbleDiameter] = useState(DEFAULT_DIAMETER)
  // Bubble defaults to collapsed on mount (#202) — this mirror starts
  // collapsed too, so the header reserves the collapsed size, not the
  // (not-yet-reported) expanded diameter, before the bubble's own mount
  // effect confirms it. Drives minHeight only — eager-on-expand,
  // delayed-on-collapse (never-shrink-while-overlapping rule).
  const [bubbleCollapsed, setBubbleCollapsed] = useState(true)
  // Separate from bubbleCollapsed (#202): the title fade needs "is the
  // bubble actually covering me right now," delayed in *both* directions
  // (docs/design-decisions/inset-crop-bubble.md) — bubbleCollapsed's eager
  // expand-report would fade the title before the bubble has visually slid
  // into place over it.
  const [bubbleSettledCollapsed, setBubbleSettledCollapsed] = useState(true)
  // While collapsed, the bubble is docked flat at the edge — the header
  // only needs to reserve the collapsed size, not whatever it last
  // expanded to (#202).
  const reservedHeight = bubbleCollapsed ? COLLAPSED_DIAMETER : bubbleDiameter

  return (
    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.inner}>
        <View
          testID="cat-form-header-zone"
          style={[
            styles.headerZone,
            catId ? { minHeight: reservedHeight } : null,
          ]}
        >
          <View style={styles.header}>
            <Text
              style={[
                styles.title,
                catId && !bubbleSettledCollapsed ? styles.titleFaded : null,
              ]}
            >
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
              onCollapsedChange={setBubbleCollapsed}
              onSettledChange={setBubbleSettledCollapsed}
            />
          )}
        </View>
        <CatForm form={form} submit={submit} />
      </View>
    </ScrollView>
  )
}
