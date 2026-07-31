import { SegmentedControl } from '@/src/components/atoms/SegmentedControl'
import { DateTimePickerButton } from '@/src/components/organisms/DateTimePicker'
import {
  AUTOSAVE_CLEAR_MS,
  AUTOSAVE_INSTANT_MS,
  AUTOSAVE_TEXT_MS,
} from '@/src/config/constants'
import { useSubmissionStore } from '@/src/hooks'
import { captureCurrentLocation } from '@/src/lib/location'
import type {
  LocationMethod,
  TimeMethod,
} from '@/src/lib/cache/submissionCache'
import {
  createSubmissionCache,
  getCurrentCacheId,
  updateSubmissionCache,
} from '@/src/lib/cache/submissionCache'
import type { LocationType } from '@/src/types'
import { validateSubmission } from '@/src/utils/validation'
import { router, type Href } from 'expo-router'
import { randomUUID } from 'expo-crypto'
import { Info } from 'lucide-react-native'
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Alert, Pressable, Text, TextInput, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

// The map picker (route added in the #102 slice). A `device` fix that
// fails, or a `pin` selection, routes here to set the Submission location.
// Cast until #102 adds the route file, which regenerates expo-router's
// typed-route union to include it.
const LOCATION_PICKER_ROUTE = '/submission/location-picker' as Href

const LOCATION_OPTIONS: { value: LocationMethod; label: string }[] = [
  { value: 'device', label: 'Device' },
  { value: 'pin', label: 'Pin Drop' },
  { value: 'address', label: 'Address' },
]
const TIME_OPTIONS: { value: TimeMethod; label: string }[] = [
  { value: 'device', label: 'Now' },
  { value: 'manual', label: 'Manual' },
  { value: 'metadata', label: 'From Photo' },
]

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function CreateSubmissionScreen() {
  const { theme } = useUnistyles()

  const submission = useSubmissionStore((s) => s.submission)
  const setSubmission = useSubmissionStore((s) => s.setSubmission)
  const setLocationType = useSubmissionStore((s) => s.setLocationType)
  const setSubmissionLocation = useSubmissionStore(
    (s) => s.setSubmissionLocation,
  )
  const setTimeType = useSubmissionStore((s) => s.setTimeType)
  const setAddress = useSubmissionStore((s) => s.setAddress)
  const setManualTime = useSubmissionStore((s) => s.setManualTime)
  const saveDraft = useSubmissionStore((s) => s.saveDraft)
  const setCurrentStep = useSubmissionStore((s) => s.setCurrentStep)
  const cats = useSubmissionStore((s) => s.cats)

  const [locationType, setLocationTypeLocal] = useState<LocationMethod>(
    submission.location_type,
  )
  const [timeType, setTimeTypeLocal] = useState<TimeMethod>(
    submission.time_type,
  )
  const [address, setAddressLocal] = useState(submission.address ?? '')
  const [manualTime, setManualTimeLocal] = useState(
    submission.manual_time ?? new Date().toISOString(),
  )
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [showLocationHelp, setShowLocationHelp] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)
  const isDirtyRef = useRef(false)
  const formRef = useRef({ locationType, timeType, address, manualTime })
  useEffect(() => {
    formRef.current = { locationType, timeType, address, manualTime }
  })

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
    return () => {
      isMountedRef.current = false
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [
    setCurrentStep,
    submission.address,
    submission.location_type,
    submission.time_type,
    submission.manual_time,
  ])

  const performSave = useCallback(async () => {
    const {
      locationType: lt,
      timeType: tt,
      address: addr,
      manualTime: mt,
    } = formRef.current
    isDirtyRef.current = false
    if (isMountedRef.current) startTransition(() => setSaveStatus('saving'))
    try {
      setSubmission({
        location_type: lt,
        time_type: tt,
        address: addr || undefined,
        manual_time: tt === 'manual' ? mt : undefined,
      })
      await Promise.resolve(saveDraft())
      const { submission: cur } = useSubmissionStore.getState()
      const location_type: LocationType | undefined =
        cur.latitude != null && cur.longitude != null
          ? {
              latitude: cur.latitude,
              longitude: cur.longitude,
              accuracy: cur.accuracy ?? null,
            }
          : undefined
      const cId = await getCurrentCacheId()
      if (cId)
        await updateSubmissionCache(cId, {
          metadata: {
            location_method: lt,
            time_method: tt,
            location_type,
            address: addr || undefined,
            manual_time: tt === 'manual' ? mt : undefined,
          },
        })
      if (!isMountedRef.current) return
      startTransition(() => setSaveStatus('saved'))
      setTimeout(() => {
        if (isMountedRef.current) startTransition(() => setSaveStatus('idle'))
      }, AUTOSAVE_CLEAR_MS)
    } catch {
      if (isMountedRef.current) startTransition(() => setSaveStatus('error'))
    }
  }, [setSubmission, saveDraft])

  const scheduleAutosave = useCallback(
    (ms: number) => {
      isDirtyRef.current = true
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(performSave, ms)
    },
    [performSave],
  )

  const handleLocationTypeChange = useCallback(
    (v: LocationMethod) => {
      setLocationTypeLocal(v)
      setLocationType(v)
      scheduleAutosave(AUTOSAVE_INSTANT_MS)
    },
    [setLocationType, scheduleAutosave],
  )
  const handleTimeTypeChange = useCallback(
    (v: TimeMethod) => {
      setTimeTypeLocal(v)
      setTimeType(v)
      scheduleAutosave(AUTOSAVE_INSTANT_MS)
    },
    [setTimeType, scheduleAutosave],
  )
  const handleAddressChange = useCallback(
    (v: string) => {
      setAddressLocal(v)
      setAddress(v)
      scheduleAutosave(AUTOSAVE_TEXT_MS)
    },
    [setAddress, scheduleAutosave],
  )
  const handleAddressBlur = useCallback(() => {
    if (!isDirtyRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    performSave()
  }, [performSave])

  const handleManualTimeChange = useCallback(
    (date: Date) => {
      const iso = date.toISOString()
      setManualTimeLocal(iso)
      setManualTime(iso)
      scheduleAutosave(AUTOSAVE_INSTANT_MS)
    },
    [setManualTime, scheduleAutosave],
  )

  const handleContinue = useCallback(async () => {
    // Acquire the single Submission location before validating (ADR 0002).
    // Only one location call per submission: skip if coords already exist.
    let latitude = submission.latitude
    let longitude = submission.longitude
    if (latitude == null || longitude == null) {
      if (locationType === 'device') {
        const fix = await captureCurrentLocation()
        if (fix) {
          setSubmissionLocation(fix)
          latitude = fix.latitude
          longitude = fix.longitude
        } else {
          // GPS denied/timed out → fall back to the map picker.
          router.push(LOCATION_PICKER_ROUTE)
          return
        }
      } else if (locationType === 'pin') {
        // Manual selection → map picker sets the Submission location.
        router.push(LOCATION_PICKER_ROUTE)
        return
      }
    }

    const errors = validateSubmission({
      location_type: locationType,
      time_type: timeType,
      address,
      manual_time: timeType === 'manual' ? manualTime : undefined,
      latitude,
      longitude,
    })
    if (errors.length > 0) {
      Alert.alert(errors[0].message)
      return
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    await performSave()
    router.push('/submission/cats')
  }, [
    locationType,
    timeType,
    address,
    manualTime,
    submission.latitude,
    submission.longitude,
    setSubmissionLocation,
    performSave,
  ])

  const saveIndicatorText =
    saveStatus === 'saving'
      ? 'Saving…'
      : saveStatus === 'saved'
        ? '✓ Saved'
        : saveStatus === 'error'
          ? 'Save failed'
          : ''

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Submission</Text>
      <View style={styles.card}>
        <SegmentedControl
          label="Location Type"
          options={LOCATION_OPTIONS}
          value={locationType}
          onChange={handleLocationTypeChange}
        />
        <Pressable
          onPress={() => setShowLocationHelp((v) => !v)}
          accessibilityLabel="About submission location"
          accessibilityRole="button"
          style={styles.locationHelpToggle}
        >
          <Info size={14} color={theme.colors.muted} />
          <Text style={styles.locationHelpToggleText}>
            One location per submission
          </Text>
        </Pressable>
        {showLocationHelp && (
          <Text style={styles.locationHelpText}>
            Each submission is tagged with a single location shared by all its
            photos. Record cats seen at separate locations as separate
            submissions.
          </Text>
        )}
        {locationType === 'address' && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput
              placeholder="Enter address"
              placeholderTextColor={theme.colors.muted}
              value={address}
              onChangeText={handleAddressChange}
              onBlur={handleAddressBlur}
              style={styles.input}
            />
          </View>
        )}
        <SegmentedControl
          label="Time Type"
          options={TIME_OPTIONS}
          value={timeType}
          onChange={handleTimeTypeChange}
        />
        {timeType === 'manual' && (
          <DateTimePickerButton
            label="Date & Time"
            mode="datetime"
            value={new Date(manualTime)}
            onChange={handleManualTimeChange}
          />
        )}
        <View style={styles.footerGroup}>
          {saveIndicatorText !== '' && (
            <Text style={styles.saveIndicator}>{saveIndicatorText}</Text>
          )}
          <Pressable
            onPress={handleContinue}
            disabled={!locationType || !timeType}
            style={styles.continueBtn}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </Pressable>
        </View>
      </View>

      {cats.length > 0 && (
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
        </View>
      )}
    </View>
  )
}
