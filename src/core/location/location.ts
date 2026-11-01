/**
 * config/location.ts
 * Tuning for the background Live-fix acquisition singleton (src/lib/location.ts).
 * One threshold does double duty: it's both "accurate enough to stop
 * watching" and the bar the Submission Details warning icon checks against
 * (see docs/adr/0002-location-services-model.md's amendment).
 */

// Meters. A fix at or above this is "low accuracy" — keep watching (or, past
// the stale window, show the warning icon and retry).
export const LOCATION_ACCURACY_THRESHOLD_M = 50

// Milliseconds. How long a single acquisition attempt watches before settling
// for its best fix so far and becoming eligible to retry. Also the delay
// before that retry fires — so an unresolved fix rechecks roughly every
// 2x this value.
export const LOCATION_STALE_THRESHOLD_MS = 5 * 60 * 1000
