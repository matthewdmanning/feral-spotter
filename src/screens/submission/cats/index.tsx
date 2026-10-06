import { AppButton } from '@/src/components/atoms/AppButton'
import { CatForm } from '@/src/components/organisms/CatForm'
import {
  COLLAPSED_DIAMETER,
  InsetCropBubble,
} from '@/src/components/organisms/InsetCropBubble'
import { useSubmissionStore } from '@/src/hooks'
import { useAbandonCatGuard } from '@/src/hooks/useAbandonCatGuard'
import { useActiveCatFlow } from '@/src/hooks/useActiveCatFlow'
import { useCatForm } from '@/src/hooks/useCatForm'
import { useCatSubmit } from '@/src/hooks/useCatSubmit'
import { useRemoveCat } from '@/src/hooks/useRemoveCat'
import { router, useLocalSearchParams } from 'expo-router'
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
  const { activeCatId } = useActiveCatFlow()

  const form = useCatForm(existingCat)
  const submit = useCatSubmit({ form, existingCat })
  const catId = existingCat?.local_id ?? activeCatId

  // Backing out of an unsaved cat would otherwise leave it in progress, and
  // the next "Add a Cat" would silently resume it (#304).
  useAbandonCatGuard(Boolean(existingCat))

  // #299: only a saved cat can be removed. Navigates explicitly rather than
  // router.back() — this screen is editing a cat that no longer exists once
  // the removal lands, and for the first cat of a submission Cat Form was
  // reached through a chain of `replace`s that strips Cat List off the stack
  // entirely (the same trap #203 hit).
  const removeCatWithConfirm = useRemoveCat()
  const handleRemove = existingCat
    ? () =>
        removeCatWithConfirm(existingCat.local_id, () =>
          // `removed` tells Cat List this emptiness came from a removal, so it
          // offers the annotate-or-describe choice instead of auto-skipping
          // straight back to annotate (#299).
          router.replace({
            pathname: '/submission/create',
            params: { removed: '1' },
          }),
        )
    : undefined

  // The title fade needs "is the
  // bubble actually covering me right now," delayed in *both* directions
  // (docs/agents/ui-ux/current-state/inset-crop-bubble.md): reporting on expand
  // would fade the title before the bubble has visually slid into place over it.
  const [bubbleSettledCollapsed, setBubbleSettledCollapsed] = useState(true)
  // A finger on the bubble is a drag, not a scroll: with both live, the page
  // moves under the bubble being dragged.
  const [bubbleHeld, setBubbleHeld] = useState(false)
  // The header always reserves the collapsed size, however the bubble is
  // expanded or dragged: a larger reservation shoved the form down when the
  // bubble opened from its default spot. An expanded bubble floats over the
  // form's first rows and can be dragged clear.
  return (
    <ScrollView
      style={styles.scroll}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!bubbleHeld}
    >
      <View style={styles.inner}>
        <View
          testID="cat-form-header-zone"
          style={[
            styles.headerZone,
            catId ? { minHeight: COLLAPSED_DIAMETER } : null,
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
                hitSlop={12}
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
              onSettledChange={setBubbleSettledCollapsed}
              onHoldChange={setBubbleHeld}
              draggable
            />
          )}
        </View>
        <CatForm form={form} />
        <AppButton onPress={submit.handleSave}>Save</AppButton>
        {handleRemove && (
          <AppButton onPress={handleRemove} variant="danger">
            Remove this Cat
          </AppButton>
        )}
      </View>
    </ScrollView>
  )
}
