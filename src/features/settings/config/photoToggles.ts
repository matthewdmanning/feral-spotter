/**
 * features/settings/config/photoToggles.ts
 * The Photos card's settings toggles, and which of them a build shows.
 */

import type { FeatureFlag } from '@/src/shared/config/constants'

type TogglePlatform = 'android' | 'ios' | null

interface PhotoToggle {
  key:
    | 'keep_photos_on_device'
    | 'ios_improved_camera_capture'
    | 'camera_subject_metering'
    | 'camera_performance_checks'
  label: string
  /** The feature flag that must be on for a build to show this toggle. null shows always. */
  flag: FeatureFlag | null
  /** null shows on every platform. */
  platform: TogglePlatform
}

export const PHOTO_TOGGLES: readonly PhotoToggle[] = [
  {
    key: 'keep_photos_on_device',
    label: 'Keep Photos on Device',
    flag: null,
    platform: null,
  },
  {
    key: 'ios_improved_camera_capture',
    label: 'Improved iPhone Capture',
    flag: 'experimentalCamera',
    platform: 'ios',
  },
  {
    key: 'camera_subject_metering',
    label: 'Subject Metering',
    flag: 'experimentalCamera',
    platform: null,
  },
  {
    key: 'camera_performance_checks',
    label: 'Camera Performance Checks',
    flag: 'experimentalCamera',
    platform: null,
  },
]

/**
 * The toggles a build shows: those whose flag is on (or that have none) and
 * that suit the platform.
 */
export function visiblePhotoToggles(
  flags: Readonly<Record<FeatureFlag, boolean>>,
  os: string,
): PhotoToggle[] {
  return PHOTO_TOGGLES.filter(
    (toggle) =>
      (toggle.flag === null || flags[toggle.flag]) &&
      (toggle.platform === null || toggle.platform === os),
  )
}
