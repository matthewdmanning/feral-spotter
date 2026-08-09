/**
 * lib/location.ts
 * Background Live-fix acquisition (ADR 0002, amended). A single module-level
 * task, not tied to any screen's lifecycle: it starts when the camera opens
 * and keeps running while the user works through the rest of the submission.
 *
 * The task cannot be restarted while it's actively watching — only once it
 * has settled (a good-enough fix, or the stale window ran out) does it
 * become eligible to fire again, which happens automatically on a timer
 * rather than needing another caller to notice and re-trigger it.
 *
 * Gated on the data-collection disclosure, not just OS permission: the app
 * stays usable without consent (photos still capture, submission still
 * works), but location — privileged data per the disclosure — is never
 * touched until the user has accepted it.
 */
import { hasAcceptedConsent } from '@/src/hooks/useConsentStore'
import {
  LOCATION_ACCURACY_THRESHOLD_M,
  LOCATION_STALE_THRESHOLD_MS,
} from '@/src/config/location'
import * as Device from 'expo-device'
import * as Location from 'expo-location'
import { useSyncExternalStore } from 'react'

export interface CapturedLocation {
  latitude: number
  longitude: number
  accuracy?: number | null
  timestamp: string
}

export type LocationCaptureStatus = 'idle' | 'pending' | 'resolved'

export interface LocationCaptureState {
  status: LocationCaptureStatus
  startedAt: number | null
  result: CapturedLocation | undefined
}

// Emulators rarely have a usable GPS fix without manually driving Extended
// Controls each run, so stub it in dev to keep the location path exercisable
// without that. Physical dev-build devices have real GPS and no Extended
// Controls equivalent, so they're excluded from the stub via Device.isDevice.
const DEV_STUB_LOCATION = { latitude: 34.6834, longitude: -82.8374 }

// ─── Singleton state ───────────────────────────────────────────────────────

let state: LocationCaptureState = {
  status: 'idle',
  startedAt: null,
  result: undefined,
}
let watchSubscription: { remove: () => void } | null = null
let settleTimer: ReturnType<typeof setTimeout> | null = null
let recheckTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function setState(patch: Partial<LocationCaptureState>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

function stopWatching() {
  if (settleTimer) {
    clearTimeout(settleTimer)
    settleTimer = null
  }
  if (watchSubscription) {
    watchSubscription.remove()
    watchSubscription = null
  }
}

// Once settled (good fix or stale timeout), schedule the automatic retry —
// this is what makes "cannot be restarted while ongoing, but reacquires once
// stale" self-perpetuating without needing another caller to trigger it.
function scheduleRecheck() {
  if (recheckTimer) clearTimeout(recheckTimer)
  recheckTimer = setTimeout(() => {
    void startLocationCapture()
  }, LOCATION_STALE_THRESHOLD_MS)
}

function resolve() {
  stopWatching()
  setState({ status: 'resolved' })
  scheduleRecheck()
}

/**
 * Starts (or, once stale, restarts) the background Live-fix acquisition.
 * No-op while a fetch is actively in flight — the ongoing process cannot be
 * restarted, only allowed to settle or reacquire on its own schedule.
 */
export async function startLocationCapture(): Promise<void> {
  if (state.status === 'pending') {
    if (__DEV__) console.log('[location] already pending — no-op')
    return
  }

  if (!hasAcceptedConsent()) {
    if (__DEV__) console.log('[location] no consent — not starting')
    return
  }

  const { status } = await Location.getForegroundPermissionsAsync()
  if (status !== Location.PermissionStatus.GRANTED) {
    if (__DEV__)
      console.log(
        `[location] permission not granted (${status}) — not starting`,
      )
    return
  }

  if (recheckTimer) {
    clearTimeout(recheckTimer)
    recheckTimer = null
  }
  setState({ status: 'pending', startedAt: Date.now(), result: undefined })

  if (__DEV__ && !Device.isDevice) {
    setState({
      result: { ...DEV_STUB_LOCATION, timestamp: new Date().toISOString() },
    })
    resolve()
    return
  }

  settleTimer = setTimeout(resolve, LOCATION_STALE_THRESHOLD_MS)

  if (__DEV__) console.log('[location] starting watchPositionAsync')

  try {
    watchSubscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 1000 },
      (fix) => {
        const candidate: CapturedLocation = {
          latitude: fix.coords.latitude,
          longitude: fix.coords.longitude,
          accuracy: fix.coords.accuracy,
          timestamp: new Date(fix.timestamp).toISOString(),
        }
        const isBetter =
          state.result == null ||
          (candidate.accuracy ?? Infinity) < (state.result.accuracy ?? Infinity)
        if (isBetter) setState({ result: candidate })

        if (
          candidate.accuracy != null &&
          candidate.accuracy < LOCATION_ACCURACY_THRESHOLD_M
        ) {
          resolve()
        }
      },
    )
  } catch (err) {
    if (__DEV__) console.log('[location] watchPositionAsync threw:', err)
    resolve()
  }
}

export function getLocationCaptureState(): LocationCaptureState {
  return state
}

export function subscribeLocationCapture(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Live view of the background acquisition, for the Submission Details icon. */
export function useLocationCapture(): LocationCaptureState {
  return useSyncExternalStore(
    subscribeLocationCapture,
    getLocationCaptureState,
    getLocationCaptureState,
  )
}

/**
 * Tears the background acquisition down entirely — the recheck timer
 * otherwise reacquires every LOCATION_STALE_THRESHOLD_MS for the rest of the
 * app's lifetime. Call this when the submission the fix was for is done
 * (submitted or reset), not on navigation — the task is meant to survive
 * that.
 */
export function stopLocationCapture(): void {
  stopWatching()
  if (recheckTimer) {
    clearTimeout(recheckTimer)
    recheckTimer = null
  }
  setState({ status: 'idle', startedAt: null, result: undefined })
}

/** Test-only: resets the module singleton between test cases. */
export function __resetLocationCaptureForTests(): void {
  stopLocationCapture()
}
