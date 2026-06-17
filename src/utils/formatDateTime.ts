/**
 * utils/formatDateTime.ts
 * Pure date formatting utility — no React dependencies.
 */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul',
                'Aug','Sep','Oct','Nov','Dec']

/**
 * Formats an ISO datetime string as "Mon DD YYYY     HH:MM AM/PM"
 * (multiple spaces serve as a visual tab between date and time).
 */
export function formatDateTime(iso: string): string {
  const d    = new Date(iso)
  const mon  = MONTHS[d.getMonth()]
  const day  = String(d.getDate()).padStart(2, '0')
  const yr   = d.getFullYear()
  let   hr   = d.getHours()
  const min  = String(d.getMinutes()).padStart(2, '0')
  const ampm = hr >= 12 ? 'PM' : 'AM'
  hr = hr % 12 || 12
  return `${mon} ${day} ${yr}     ${hr}:${min} ${ampm}`
}
