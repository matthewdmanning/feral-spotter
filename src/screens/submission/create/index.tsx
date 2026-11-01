import { SubmissionOrganizations } from '@/src/components/organisms/organizations/SubmissionOrganizations'
import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { AmbientBackground } from '@/src/shared/ui/atoms/AmbientBackground'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { ButtonRow } from '@/src/shared/ui/molecules/ButtonRow'
import { FieldRow } from '@/src/shared/ui/molecules/FieldRow'
import { DateTimePickerButton } from '@/src/components/organisms/DateTimePicker'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import {
  openCatForm,
  startCatPass,
  useCatListLanding,
} from '@/src/hooks/catPass'
import { useDraftExitPrompt } from '@/src/hooks/useDraftExitPrompt'
import { useDraftSync } from '@/src/hooks/useDraftSync'
import { useSubmissionSubmit } from '@/src/hooks/useSubmissionSubmit'
import { usePhotoEntrypoints } from '@/src/hooks/usePhotoEntrypoints'
import { useRemoveCat } from '@/src/hooks/useRemoveCat'
import { draftWarnings } from '@/src/lib/submission/status'
import { router } from 'expo-router'
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown'
import { CaretUpIcon } from 'phosphor-react-native/src/icons/CaretUp'
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle'
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { describeCat, summarizeCat } from '@/src/lib/cats/attributes'
import { styles } from './index.styles'

// #97's split: this screen is now the Cats List + Submission Details landing
// view. Location/Time have no editable fields anymore — a Live fix runs in
// the background from camera-open (#128) and is only ever corrected through
// the map picker, reached by tapping the warning icon below.
const LOCATION_PICKER_ROUTE = '/submission/location-picker'

export default function CreateSubmissionScreen() {
  const { theme } = useUnistyles()
  const removeCatWithConfirm = useRemoveCat()

  const submission = useSubmissionStore((s) => s.submission)
  const setManualTime = useSubmissionStore((s) => s.setManualTime)
  const cats = useSubmissionStore((s) => s.cats)

  useDraftSync()
  const { handleDone, handleReset, handleDiscard, isSubmitting } =
    useSubmissionSubmit()

  // No back path off this screen (#156): a bottom action reopens the
  // source that started the draft, and Back asks what to do.
  const { addMore } = usePhotoEntrypoints()
  useDraftExitPrompt({ isSubmitting, addMore, onDiscard: handleDiscard })

  // One cat open at a time: a stack of fully open cats would push the bottom
  // actions off a phone screen.
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null)

  // Landing rule (#173, #189, #299): see useCatListLanding.
  const { autoSkipPending } = useCatListLanding()

  // Same warning-icon/tap-to-fix treatment for location and for a Library
  // pick whose photos lacked EXIF time (ADR 0003).
  const { location: showLocationWarning, time: showTimeWarning } =
    draftWarnings(submission)
  const handleManualTimeChange = useCallback(
    (date: Date) => setManualTime(date.toISOString()),
    [setManualTime],
  )

  const handleLocationIconPress = useCallback(() => {
    // A good Live fix is trusted and not user-editable (ADR 0002) — the
    // picker is reachable only when GPS hasn't produced one.
    if (!showLocationWarning) return
    router.push(LOCATION_PICKER_ROUTE)
  }, [showLocationWarning])

  // Annotate-first (ADR 0004): discovering a cat starts with boxing it, not
  // filling out a form — Cat Form is reached from annotate's Boxing
  // Complete, not from here.
  const handleAddCat = startCatPass

  // Auto-skip in flight (#173) — nothing to show this frame. Only while the
  // redirect is actually pending: once cats hits 0 by removal instead, the
  // empty state below renders (#299).
  if (cats.length === 0 && autoSkipPending) return null

  return (
    <View style={styles.root}>
      <AmbientBackground />
      {/* An open cat lists every field, so the part above the actions scrolls
          and Finished!, Take More Photos and Reset stay on screen. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Reset is rare and destructive, so it stays out of the thumb zone
            beside Finished!. Same header text-button pattern as Cat Form's
            Clear. It still confirms first (handleReset). */}
        <View style={styles.header}>
          <Text style={styles.title}>Submission</Text>
          <TextButton
            onPress={handleReset}
            tone="danger"
            disabled={isSubmitting}
          >
            Reset
          </TextButton>
        </View>

        <GlassSurface kind="card" style={styles.statusRow}>
          <Pressable
            onPress={handleLocationIconPress}
            disabled={!showLocationWarning}
            accessibilityRole="button"
            accessibilityLabel={
              showLocationWarning
                ? 'Location accuracy is low or unavailable — tap to set manually'
                : 'Location acquired'
            }
            style={styles.statusItem}
          >
            {showLocationWarning ? (
              <WarningCircleIcon
                size={theme.iconSize.md}
                color={theme.colors.warning}
              />
            ) : (
              <CheckCircleIcon
                size={theme.iconSize.md}
                color={theme.colors.success}
              />
            )}
            <Text style={styles.statusItemText}>Location</Text>
          </Pressable>

          {showTimeWarning ? (
            <View style={styles.statusItem}>
              <WarningCircleIcon
                size={theme.iconSize.md}
                color={theme.colors.warning}
              />
              <DateTimePickerButton
                value={
                  submission.manual_time
                    ? new Date(submission.manual_time)
                    : new Date()
                }
                onChange={handleManualTimeChange}
                label=""
                maximumDate={new Date()}
              />
            </View>
          ) : (
            <View style={styles.statusItem}>
              <CheckCircleIcon
                size={theme.iconSize.md}
                color={theme.colors.success}
              />
              <Text style={styles.statusItemText}>Date & Time Recorded</Text>
            </View>
          )}
        </GlassSurface>

        <View style={styles.catList}>
          <Text style={styles.catListTitle}>Cats Recorded</Text>
          {cats.map((cat) => {
            const label = summarizeCat(cat)
            const isExpanded = expandedCatId === cat.local_id
            return (
              <GlassSurface
                kind="card"
                key={cat.local_id}
                style={styles.catCard}
              >
                <Pressable
                  onPress={() =>
                    setExpandedCatId(isExpanded ? null : cat.local_id)
                  }
                  style={({ pressed }) => [
                    styles.catRow,
                    pressed && styles.catRowPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Cat: ${label}`}
                  accessibilityState={{ expanded: isExpanded }}
                >
                  <Text style={styles.catRowText}>{label}</Text>
                  {isExpanded ? (
                    <CaretUpIcon
                      size={theme.iconSize.md}
                      color={theme.colors.muted}
                    />
                  ) : (
                    <CaretDownIcon
                      size={theme.iconSize.md}
                      color={theme.colors.muted}
                    />
                  )}
                </Pressable>
                {isExpanded && (
                  <View style={styles.catDetails}>
                    {describeCat(cat).map(({ label, value }) => (
                      <FieldRow key={label} label={label} value={value} />
                    ))}
                    <View style={styles.catActions}>
                      <ButtonRow>
                        <AppButton
                          variant="secondary"
                          onPress={() => openCatForm(cat.local_id)}
                        >
                          Edit
                        </AppButton>
                        <AppButton
                          variant="danger"
                          onPress={() => removeCatWithConfirm(cat.local_id)}
                        >
                          Delete
                        </AppButton>
                      </ButtonRow>
                    </View>
                  </View>
                )}
              </GlassSurface>
            )
          })}
          {/* #299: no cats left. Two ways back in, neither forced — the user
            may want another look at the photos, or may want to describe a
            cat they saw but cannot pick out of one. The annotate button is
            the same control either way, so only its label switches. */}
          {cats.length === 0 && (
            <Text style={styles.emptyCatsText}>
              No cats recorded. Pick one out of your photos, or describe a cat
              you saw. Your photos are still here either way.
            </Text>
          )}
          <AppButton variant="secondary" onPress={handleAddCat}>
            {cats.length === 0 ? 'Annotate Photos' : 'Add a Cat'}
          </AppButton>
          {cats.length === 0 && (
            // Describing a cat without annotating it first: it saves with an
            // empty photo_local_ids (useCatSubmit derives that from boxes) — a
            // record of a cat that was seen but can't be picked out of a photo.
            <AppButton onPress={() => openCatForm()} variant="secondary">
              Describe a Cat
            </AppButton>
          )}
        </View>
        <SubmissionOrganizations />
      </ScrollView>

      {/* Actions pinned to the bottom. The primary action is last, on the
          right, nearest the thumb — the same order as every other ButtonRow. */}
      <View style={styles.bottomActions}>
        {/* #375: "Finished!" is a hard block at zero cats (#265), and the
            button said nothing about it. */}
        {cats.length === 0 && (
          <Text style={styles.disabledReason}>
            Describe at least one cat before you finish.
          </Text>
        )}
        <ButtonRow>
          <AppButton
            variant="secondary"
            onPress={addMore.open}
            disabled={isSubmitting}
          >
            {addMore.label}
          </AppButton>
          <AppButton
            onPress={handleDone}
            disabled={cats.length === 0}
            loading={isSubmitting}
          >
            Finished!
          </AppButton>
        </ButtonRow>
      </View>
    </View>
  )
}
