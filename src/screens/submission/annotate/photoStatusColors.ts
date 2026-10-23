import type { PhotoPassStatus } from '@/src/hooks/useActiveCatFlow'

/**
 * Progress-dot color per photo, as a theme color key. The current photo
 * overrides this with the text color.
 */
export const PHOTO_STATUS_COLOR_KEY: Record<
  PhotoPassStatus,
  'accent' | 'warning' | 'muted'
> = {
  located: 'accent',
  'not-in-photo': 'warning',
  pending: 'muted',
}
