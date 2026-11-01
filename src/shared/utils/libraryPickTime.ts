/**
 * utils/libraryPickTime.ts
 * ADR 0003: a Library pick's time comes from EXIF DateTime when present,
 * else falls back to manual entry. Split into pure functions so the
 * EXIF-format landmine (below) and the multi-select rule are unit-testable
 * without touching expo-image-picker.
 */

// EXIF `DateTime` is "YYYY:MM:DD HH:MM:SS" (colons in the date, no timezone) —
// not directly parseable by `new Date()`. A zeroed clock ("0000:00:00 00:00:00")
// is a known camera quirk meaning "no real timestamp" and must be rejected,
// not returned as an invalid Date.
const EXIF_DATETIME_RE = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/

/** Parses an EXIF `DateTime` string into an ISO string, or undefined if absent/invalid. */
export function parseExifDateTime(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const match = EXIF_DATETIME_RE.exec(raw)
  if (!match) return undefined

  const [, year, month, day, hour, minute, second] = match
  if (year === '0000') return undefined

  // No timezone in EXIF DateTime — treated as local capture time, same as
  // the ISO string the Date constructor would parse without a trailing Z.
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

export interface LibraryPickTimeResult {
  time_type: 'device' | 'manual'
  captured_at?: string
}

/**
 * Multi-select interim MVP rule (ADR 0003): every photo has EXIF time →
 * earliest one wins. Any one missing → whole batch falls back to manual.
 */
export function classifyLibraryPickTime(
  capturedAts: (string | undefined)[],
): LibraryPickTimeResult {
  if (capturedAts.length === 0 || capturedAts.some((t) => t === undefined)) {
    return { time_type: 'manual' }
  }
  const earliest = (capturedAts as string[]).reduce((min, t) =>
    new Date(t).getTime() < new Date(min).getTime() ? t : min,
  )
  return { time_type: 'device', captured_at: earliest }
}
