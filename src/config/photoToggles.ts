/**
 * config/photoToggles.ts
 * The Photos card's settings toggles, and which of them a build shows.
 */

import type { FeatureFlag } from './constants'

type TogglePlatform = 'android' | 'ios' | null

interface PhotoToggle {
  key:
    | 'keep_photos_on_device'
    | 'improved_camera_capture'
    | 'ios_improved_camera_capture'
    | 'native_camera_capture'
    | 'camera_max_detail'
    | 'camera_motion_priority'
    | 'camera_disable_low_light_boost'
    | 'camera_subject_metering'
    | 'camera_pinch_zoom'
    | 'camera_performance_checks'
  label: string
  desc: string
  /** The feature flag that must be on for a build to show this toggle. null shows always. */
  flag: FeatureFlag | null
  /** null shows on every platform. */
  platform: TogglePlatform
}

export const PHOTO_TOGGLES: readonly PhotoToggle[] = [
  {
    key: 'keep_photos_on_device',
    label: 'Keep Photos on Device',
    desc: 'Save captured photos to your camera roll',
    flag: null,
    platform: null,
  },
  {
    key: 'improved_camera_capture',
    label: 'Improved Camera Capture',
    desc: 'Use device-aware VisionCamera capture on Android',
    flag: 'experimentalCamera',
    platform: 'android',
  },
  {
    key: 'ios_improved_camera_capture',
    label: 'Improved iPhone Capture',
    desc: 'Use the optimized VisionCamera + AVFoundation fallback on iOS',
    flag: 'experimentalCamera',
    platform: 'ios',
  },
  {
    key: 'native_camera_capture',
    label: 'Native Camera Capture',
    desc: 'Use AVFoundation on iOS or CameraX on Android; the VisionCamera path remains available',
    flag: 'experimentalCamera',
    platform: null,
  },
  {
    key: 'camera_max_detail',
    label: 'Maximum Detail',
    desc: 'Prefer the highest still-photo resolution exposed by the native camera',
    flag: 'experimentalCamera',
    platform: null,
  },
  {
    key: 'camera_motion_priority',
    label: 'Motion Priority',
    desc: 'Favor device-supported low-latency capture and shorter exposure behavior',
    flag: 'experimentalCamera',
    platform: null,
  },
  {
    key: 'camera_disable_low_light_boost',
    label: 'Disable Low-Light Boost',
    desc: 'Avoid platform low-light modes that may trade motion detail for brightness',
    flag: 'experimentalCamera',
    platform: null,
  },
  {
    key: 'camera_subject_metering',
    label: 'Subject Metering',
    desc: 'Allow a bounding-box localizer to steer native focus and exposure',
    flag: 'experimentalCamera',
    platform: null,
  },
  {
    key: 'camera_pinch_zoom',
    label: 'Pinch to Zoom',
    desc: 'Pinch to zoom the preview. The saved photo stays full field',
    flag: 'experimentalCamera',
    platform: 'android',
  },
  {
    key: 'camera_performance_checks',
    label: 'Camera Performance Checks',
    desc: 'Attach comparable camera timing data to PostHog events for A/B testing',
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
