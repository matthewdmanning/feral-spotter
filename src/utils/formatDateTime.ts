/**
 * utils/formatDateTime.ts
 * Pure date formatting utility — no React dependencies.
 */

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
  const mon = MONTH_FMT.format(d)
  const day = String(d.getDate()).padStart(2, '0')
  const yr = d.getFullYear()
  return `${mon} ${day} ${yr}     ${TIME_FMT.format(d)}`
}
