/**
 * lib/submission/status.ts
 * Which of a draft's location and time need the user's attention, for the
 * warning icons on Submission Details.
 */

import { LOCATION_ACCURACY_THRESHOLD_M } from '@/src/config/location'

/** The draft fields these rules read. */
interface DraftLocationAndTime {
  latitude?: number
  longitude?: number
  accuracy?: number | null
  time_type: string
  manual_time?: string
}

export interface DraftWarnings {
  /** No fix yet, or a fix too coarse to trust: the map picker is offered. */
  location: boolean
  /** A manual-time draft (no usable EXIF time) whose time is not set yet. */
  time: boolean
}

export function draftWarnings(draft: DraftLocationAndTime): DraftWarnings {
  const hasFix = draft.latitude != null && draft.longitude != null
  const hasLowAccuracy =
    draft.accuracy != null && draft.accuracy >= LOCATION_ACCURACY_THRESHOLD_M
  return {
    location: !hasFix || hasLowAccuracy,
    time: draft.time_type === 'manual' && !draft.manual_time,
  }
}
