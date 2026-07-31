import { LOCATION_ACCURACY_THRESHOLD_M } from '@/src/config/location'
import { useSubmissionStore } from '@/src/hooks'
import { useSubmissionSubmit } from '@/src/hooks/useSubmissionSubmit'
import { useLocationCapture } from '@/src/lib/location'
import {
  createSubmissionCache,
  getCurrentCacheId,
} from '@/src/lib/cache/submissionCache'
import { router, type Href } from 'expo-router'
import { randomUUID } from 'expo-crypto'
import { AlertCircle, CheckCircle } from 'lucide-react-native'
import { useCallback, useEffect } from 'react'
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

  const submission = useSubmissionStore((s) => s.submission)
  const setSubmissionLocation = useSubmissionStore(
    (s) => s.setSubmissionLocation,
  )
  const setCurrentStep = useSubmissionStore((s) => s.setCurrentStep)
  const cats = useSubmissionStore((s) => s.cats)

  const capture = useLocationCapture()
  const { handleDone } = useSubmissionSubmit()

  useEffect(() => {
    setCurrentStep('create')
    ;(async () => {
      if (!(await getCurrentCacheId())) {
        await createSubmissionCache(randomUUID(), {
          location_method: submission.location_type,
          time_method: submission.time_type,
          address: submission.address,
          manual_time: submission.manual_time,
        })
      }
    })()
  }, [
    setCurrentStep,
    submission.address,
    submission.location_type,
    submission.time_type,
    submission.manual_time,
  ])

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

  const handleLocationIconPress = useCallback(() => {
    // A good Live fix is trusted and not user-editable (ADR 0002) — the
    // picker is reachable only when GPS hasn't produced one.
    if (!showLocationWarning) return
    router.push(LOCATION_PICKER_ROUTE)
  }, [showLocationWarning])

  const handleAddCat = useCallback(() => {
    router.push('/submission/cats')
  }, [])

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

        <View style={styles.statusItem}>
          <CheckCircle size={20} color={theme.colors.success} />
          <Text style={styles.statusItemText}>Date & Time Recorded</Text>
        </View>
      </View>

      <View style={styles.catList}>
        <Text style={styles.catListTitle}>Cats Recorded</Text>
        {cats.map((cat) => (
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
            <Text style={styles.catRowText}>
              {cat.age.charAt(0).toUpperCase() + cat.age.slice(1)} ·{' '}
              {cat.pattern} · {cat.hair_length} hair
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={handleAddCat}
          style={styles.addCatBtn}
          accessibilityRole="button"
        >
          <Text style={styles.addCatBtnText}>Add a Cat</Text>
        </Pressable>
      </View>

      <Pressable onPress={handleDone} style={styles.doneBtn}>
        <Text style={styles.doneBtnText}>Done</Text>
      </Pressable>
    </View>
  )
}
