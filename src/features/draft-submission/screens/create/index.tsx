import { useOrganizationsEnabled } from '@/src/features/organizations/hooks/useOrganizationsFlag'
import { SubmissionOrganizations } from '@/src/features/organizations/sharing/components/SubmissionOrganizations'
import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { AmbientBackground } from '@/src/shared/ui/atoms/AmbientBackground'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { ButtonRow } from '@/src/shared/ui/molecules/ButtonRow'
import { FieldRow } from '@/src/shared/ui/molecules/FieldRow'
import { DateTimePickerButton } from '@/src/features/draft-submission/components/DateTimePicker'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import {
  openCatForm,
  startCatPass,
  useCatListLanding,
} from '@/src/features/draft-submission/hooks/catPass'
import { useDraftExitPrompt } from '@/src/features/draft-submission/hooks/useDraftExitPrompt'
import { useDraftSync } from '@/src/features/draft-submission/hooks/useDraftSync'
import { useSubmissionSubmit } from '@/src/features/draft-submission/hooks/useSubmissionSubmit'
import { usePhotoEntrypoints } from '@/src/workflows/photo-entry/hooks/usePhotoEntrypoints'
import { useNoPhotosPrompt } from '@/src/workflows/photo-entry/hooks/useNoPhotosPrompt'
import { useRemoveCat } from '@/src/features/draft-submission/hooks/useRemoveCat'
import { draftWarnings } from '@/src/features/draft-submission/lib/status'
import {
  commonCopy,
  formatCopy,
  submissionCopy,
} from '@/src/shared/config/text'
import { router } from 'expo-router'
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown'
import { CaretUpIcon } from 'phosphor-react-native/src/icons/CaretUp'
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle'
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle'
import { useCallback, useState } from 'react'
import { Text } from '@/src/shared/ui/atoms/Text'
import { Pressable, ScrollView, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import {
  describeCat,
  summarizeCat,
} from '@/src/features/draft-submission/lib/attributes'
import { styles } from './index.styles'

// #97's split: this screen is now the Cats List + Submission Details landing
// view. Location/Time have no editable fields anymore — a Live fix runs in
// the background from camera-open (#128) and is only ever corrected through
// the map picker, reached by tapping the location icon below.
const LOCATION_PICKER_ROUTE = '/submission/location-picker'

export default function CreateSubmissionScreen() {
  const { theme } = useUnistyles()
  const organizationsEnabled = useOrganizationsEnabled()
  const removeCatWithConfirm = useRemoveCat()

  const submission = useSubmissionStore((s) => s.submission)
  const setManualTime = useSubmissionStore((s) => s.setManualTime)
  const cats = useSubmissionStore((s) => s.cats)
  const photos = usePhotoStore((s) => s.photos)

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
  const canEditLocation =
    showLocationWarning || submission.location_type === 'pin'
  const handleManualTimeChange = useCallback(
    (date: Date) => setManualTime(date.toISOString()),
    [setManualTime],
  )

  const handleLocationIconPress = useCallback(() => {
    // A good Live fix is trusted and not user-editable (ADR 0002) — the
    // picker is reachable when GPS hasn't produced one, or to adjust an
    // existing manual pin.
    if (!canEditLocation) return
    router.push(LOCATION_PICKER_ROUTE)
  }, [canEditLocation])

  // Annotate-first (ADR 0004): discovering a cat starts with boxing it, not
  // filling out a form — Cat Form is reached from annotate's Boxing
  // Complete, not from here. With no photos, ask instead (#503).
  const { offer: offerNoPhotos } = useNoPhotosPrompt()
  const handleAddCat = useCallback(() => {
    if (!startCatPass()) offerNoPhotos()
  }, [offerNoPhotos])

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
          <Text style={styles.title}>{submissionCopy.create.title}</Text>
          <TextButton
            onPress={handleReset}
            tone="danger"
            disabled={isSubmitting}
          >
            {commonCopy.reset}
          </TextButton>
        </View>

        <GlassSurface kind="card" style={styles.statusRow}>
          <Pressable
            onPress={handleLocationIconPress}
            disabled={!canEditLocation}
            accessibilityRole="button"
            accessibilityLabel={
              showLocationWarning
                ? submissionCopy.location.accuracyUncertainAccessibility
                : submission.location_type === 'pin'
                  ? submissionCopy.location.manualAccessibility
                  : submissionCopy.location.acquiredAccessibility
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
            <Text style={styles.statusItemText}>
              {submissionCopy.location.label}
            </Text>
          </Pressable>

          {showTimeWarning ? (
            <View style={styles.statusItem}>
              <WarningCircleIcon
                size={theme.iconSize.md}
                color={theme.colors.warning}
              />
              <DateTimePickerButton
                // Shown only while unset (draftWarnings), so it reads
                // "Time unknown", never today's date (LOGIC-1).
                value={undefined}
                emptyLabel={submissionCopy.time.unknown}
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
              <Text style={styles.statusItemText}>
                {submissionCopy.time.recorded}
              </Text>
            </View>
          )}
        </GlassSurface>

        {organizationsEnabled && photos.length > 0 && (
          <SubmissionOrganizations />
        )}

        <View style={styles.catList}>
          <Text style={styles.catListTitle}>
            {submissionCopy.create.catsRecorded}
          </Text>
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
                  accessibilityLabel={formatCopy(submissionCopy.create.cat, {
                    label,
                  })}
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
                          {commonCopy.edit}
                        </AppButton>
                        <AppButton
                          variant="danger"
                          onPress={() => removeCatWithConfirm(cat.local_id)}
                        >
                          {commonCopy.delete}
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
              {submissionCopy.create.noCats}
            </Text>
          )}
          <AppButton variant="secondary" onPress={handleAddCat}>
            {cats.length === 0
              ? submissionCopy.create.annotatePhotos
              : submissionCopy.create.addCat}
          </AppButton>
          {cats.length === 0 && (
            // Describing a cat without annotating it first: it saves with an
            // empty photo_local_ids (useCatSubmit derives that from boxes) — a
            // record of a cat that was seen but can't be picked out of a photo.
            <AppButton onPress={() => openCatForm()} variant="secondary">
              {submissionCopy.create.describeCat}
            </AppButton>
          )}
        </View>
      </ScrollView>

      {/* Actions pinned to the bottom. The primary action is last, on the
          right, nearest the thumb — the same order as every other ButtonRow. */}
      <View style={styles.bottomActions}>
        {/* #375: "Finished!" is a hard block at zero cats (#265), and the
            button said nothing about it. */}
        {cats.length === 0 && (
          <Text style={styles.disabledReason}>
            {submissionCopy.create.finishNeedsCat}
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
            {submissionCopy.finishedLabel}
          </AppButton>
        </ButtonRow>
      </View>
    </View>
  )
}
