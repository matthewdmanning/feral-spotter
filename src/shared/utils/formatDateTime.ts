/**
 * shared/utils/formatDateTime.ts
 * Pure date formatting utility — no React dependencies.
 */

import { commonCopy } from '@/src/shared/config/text'

const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'short' })
const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

/**
 * Formats an ISO datetime string as "Mon DD YYYY     HH:MM AM/PM"
 * (multiple spaces serve as a visual tab between date and time).
 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  // Intl throws a RangeError on an invalid date; one bad row must not take
  // down the whole Reports list.
  if (Number.isNaN(d.getTime())) return commonCopy.unknownTime
  const mon = MONTH_FMT.format(d)
  const day = String(d.getDate()).padStart(2, '0')
  const yr = d.getFullYear()
  return `${mon} ${day} ${yr}     ${TIME_FMT.format(d)}`
}

/** "Mon DD YYYY, HH:MM AM/PM", for a date inside a sentence. */
export function formatInlineDateTime(iso: string): string {
  return formatDateTime(iso).replace(/\s{2,}/, ', ')
}
