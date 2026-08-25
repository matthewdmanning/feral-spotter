import { LOCATION_ACCURACY_THRESHOLD_M } from '@/src/config/location'
import { DateTimePickerButton } from '@/src/components/organisms/DateTimePicker'
import { useSubmissionStore } from '@/src/hooks'
import { useSubmissionSubmit } from '@/src/hooks/useSubmissionSubmit'
import { useLibraryPhotoPicker } from '@/src/hooks/useLibraryPhotoPicker'
import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useRemoveCat } from '@/src/hooks/useRemoveCat'
import { useLocationCapture } from '@/src/lib/location'
import {
  createSubmissionCache,
  getCurrentCacheId,
} from '@/src/lib/cache/submissionCache'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import { randomUUID } from 'expo-crypto'
import { AlertCircle, CheckCircle, Trash2 } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

// #97's split: this screen is now the Cats List + Submission Details landing
// view. Location/Time have no editable fields anymore — a Live fix runs in
// the background from camera-open (#128) and is only ever corrected through
// the map picker, reached by tapping the warning icon below.
const LOCATION_PICKER_ROUTE = '/submission/location-picker' as Href

export default function CreateSubmissionScreen() {
  const { theme } = useUnistyles()
  const removeCatWithConfirm = useRemoveCat()
  // #299: set by the Cat Form's remove, which lands back here. Distinguishes
  // "emptied by removing the last cat" from "arrived with nothing recorded",
  // which the auto-skip below treats very differently.
  const { removed } = useLocalSearchParams<{ removed?: string }>()

  const submission = useSubmissionStore((s) => s.submission)
  const setSubmissionLocation = useSubmissionStore(
    (s) => s.setSubmissionLocation,
  )
  const setManualTime = useSubmissionStore((s) => s.setManualTime)
  const setCurrentStep = useSubmissionStore((s) => s.setCurrentStep)
  const cats = useSubmissionStore((s) => s.cats)

  const capture = useLocationCapture()
  const { handleDone, handleReset } = useSubmissionSubmit()

  // No back path off this screen (#156) — instead, a bottom action returns
  // the user to whichever entrypoint sourced this draft (ADR 0002
  // amendment's single-source-by-construction `source`).
  const photoSource = usePhotoStore((s) => s.source)
  const { pickFromLibrary } = useLibraryPhotoPicker()
  const handleAddMorePhotos = useCallback(() => {
    if (photoSource === 'camera') {
      router.navigate('/camera')
    } else {
      pickFromLibrary()
    }
  }, [photoSource, pickFromLibrary])

  // Mount-once (#224 follow-up): this only needs to ensure a cache row
  // exists for the current draft, not react to every field edit. Depending
  // on submission.* fields here made it re-run when handleDone's
  // clearDraft() reset them to defaults mid-navigation (post-Submit,
  // before this screen unmounts) — current was just cleared by
  // clearCurrentCacheId(), so getCurrentCacheId() came back null and this
  // created a stray empty cache row for the already-submitted draft.
  useEffect(() => {
    setCurrentStep('create')
    ;(async () => {
      if (!(await getCurrentCacheId())) {
        await createSubmissionCache(randomUUID(), {
          location_method: submission.location_type,
          time_method: submission.time_type,
          address: submission.address,
          manual_time: submission.manual_time,
          captured_at: submission.captured_at,
        })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Zero-friction on-ramp (#173): with no cats recorded yet, skip straight
  // into annotate instead of rendering an empty Cat List. replace (not
  // push) so annotate's hardware back pops past Cat List entirely rather
  // than landing back on it and re-triggering this redirect.
  //
  // Gate on the mount-time snapshot (#189), not a live cats.length watch:
  // this is a landing-time check ("I arrived here with nothing recorded"),
  // not a standing invariant. A live watch also fires when cats drops to 0
  // for a reason other than landing here empty -- e.g. handleReset's own
  // router.replace('/') racing this effect's replace('/submission/annotate')
  // for whichever one wins the actual navigation, sending Reset to
  // annotate's empty state instead of Home. useEffect always runs after the
  // triggering synchronous callback finishes, so reordering handleReset's
  // own clearDraft()/router.replace() calls can't fix that race -- only not
  // re-running this effect on every cats.length change can.
  //
  // #299: removing the last cat must NOT auto-skip. Landing here with nothing
  // recorded means a first pass, where the user has to see the photos to pick
  // a cat out of them. Arriving because they just deleted their last cat is
  // the opposite situation — they may want to re-annotate, or they may want
  // to describe a cat they saw but can't pick out of a photo. That is their
  // call, so the empty state offers both instead of forcing annotate.
  // Lazy useState, not useRef: same mount-time snapshot, but the render below
  // has to read it to decide between "redirect in flight" and "empty state,"
  // and reading a ref during render is a React Compiler violation.
  const [autoSkipPending] = useState(() => cats.length === 0 && removed !== '1')
  useEffect(() => {
    if (autoSkipPending) router.replace('/submission/annotate')
    // autoSkipPending is frozen at mount, so listing it changes nothing at
    // runtime and keeps exhaustive-deps quiet.
  }, [autoSkipPending])

  // Commit the background Live fix into the Submission draft only once it
  // resolves — never mid-watch, so a reacquire's early (worse) candidates
  // can't clobber the already-stored fix while it's re-settling. Also never
  // overwrite a location the user set by hand via the map picker
  // (location_type === 'pin').
  useEffect(() => {
    if (submission.location_type === 'pin') return
    if (capture.status === 'resolved' && capture.result) {
      setSubmissionLocation(capture.result)
    }
  }, [
    capture.status,
    capture.result,
    submission.location_type,
    setSubmissionLocation,
  ])

  const hasLowAccuracy =
    submission.accuracy != null &&
    submission.accuracy >= LOCATION_ACCURACY_THRESHOLD_M
  const hasFix = submission.latitude != null && submission.longitude != null
  const showLocationWarning = !hasFix || hasLowAccuracy

  // Same warning-icon/tap-to-fix treatment as location, applied to a Library
  // pick whose photos lacked EXIF time (ADR 0003) — manual_time is unset
  // until the user fills it in via the picker below.
  const showTimeWarning =
    submission.time_type === 'manual' && !submission.manual_time
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
  const handleAddCat = useCallback(() => {
    router.push('/submission/annotate')
  }, [])

  // Auto-skip in flight (#173) — nothing to show this frame. Only while the
  // redirect is actually pending: once cats hits 0 by removal instead, the
  // empty state below renders (#299).
  if (cats.length === 0 && autoSkipPending) return null

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Submission</Text>

      <View style={styles.statusRow}>
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
            <AlertCircle size={20} color={theme.colors.warning} />
          ) : (
            <CheckCircle size={20} color={theme.colors.success} />
          )}
          <Text style={styles.statusItemText}>Location</Text>
        </Pressable>

        {showTimeWarning ? (
          <View style={styles.statusItem}>
            <AlertCircle size={20} color={theme.colors.warning} />
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
            <CheckCircle size={20} color={theme.colors.success} />
            <Text style={styles.statusItemText}>Date & Time Recorded</Text>
          </View>
        )}
      </View>

      <View style={styles.catList}>
        <Text style={styles.catListTitle}>Cats Recorded</Text>
        {cats.map((cat) => {
          const label = `${cat.age.charAt(0).toUpperCase() + cat.age.slice(1)} · ${cat.pattern} · ${cat.hair_length} hair`
          return (
            <Pressable
              key={cat.local_id}
              onPress={() =>
                router.push({
                  pathname: '/submission/cats',
                  params: { edit: cat.local_id },
                })
              }
              style={styles.catRow}
            >
              <Text style={styles.catRowText}>{label}</Text>
              {/* #299: nested Pressable so tapping the trash removes the cat
                  rather than opening it for edit. */}
              <Pressable
                onPress={() => removeCatWithConfirm(cat.local_id)}
                style={styles.catRowRemoveBtn}
                accessibilityRole="button"
                accessibilityLabel={`Remove cat: ${label}`}
              >
                <Trash2 size={18} color={theme.colors.danger} />
              </Pressable>
            </Pressable>
          )
        })}
        {/* #299: no cats left. Two ways back in, neither forced — the user
            may want another look at the photos, or may want to describe a
            cat they saw but cannot pick out of one. The annotate button is
            the same control either way, so only its label switches. */}
        {cats.length === 0 && (
          <Text style={styles.emptyCatsText}>
            No cats recorded. Pick one out of your photos, or describe a cat you
            saw. Your photos are still here either way.
          </Text>
        )}
        <Pressable
          onPress={handleAddCat}
          style={styles.addCatBtn}
          accessibilityRole="button"
        >
          <Text style={styles.addCatBtnText}>
            {cats.length === 0 ? 'Annotate Photos' : 'Add a Cat'}
          </Text>
        </Pressable>
        {cats.length === 0 && (
          // Describing a cat without annotating it first: it saves with an
          // empty photo_local_ids (useCatSubmit derives that from boxes) — a
          // record of a cat that was seen but can't be picked out of a photo.
          <Pressable
            onPress={() => router.push('/submission/cats')}
            style={styles.describeCatBtn}
            accessibilityRole="button"
          >
            <Text style={styles.describeCatBtnText}>Describe a Cat</Text>
          </Pressable>
        )}
      </View>

      <Pressable
        onPress={handleAddMorePhotos}
        style={styles.addPhotosBtn}
        accessibilityRole="button"
      >
        <Text style={styles.addPhotosBtnText}>
          {photoSource === 'camera' ? 'Take More Photos' : 'Select More Photos'}
        </Text>
      </Pressable>

      <Pressable
        onPress={handleDone}
        disabled={cats.length === 0}
        style={[styles.doneBtn, cats.length === 0 && styles.doneBtnDisabled]}
        accessibilityRole="button"
      >
        <Text style={styles.doneBtnText}>Finished!</Text>
      </Pressable>

      <Pressable
        onPress={handleReset}
        style={styles.resetBtn}
        accessibilityRole="button"
      >
        <Text style={styles.resetBtnText}>Reset</Text>
      </Pressable>
    </View>
  )
}
