/**
 * Experimental camera tuning must never reach a build with its flag off. This
 * reads the real toggle list, so a new experimental toggle added without a
 * flag fails here instead of shipping.
 */

import {
  PHOTO_TOGGLES,
  visiblePhotoToggles,
} from '@/src/features/settings/config/photoToggles'
import { FEATURE_FLAGS } from '@/src/shared/config/constants'

const FLAGS_OFF = { ...FEATURE_FLAGS, experimentalCamera: false }
const FLAGS_ON = { ...FEATURE_FLAGS, experimentalCamera: true }

it.each(['android', 'ios'])(
  'a build with flags off shows only the unflagged toggles for %s',
  (os) => {
    const visible = visiblePhotoToggles(FLAGS_OFF, os)
    expect(visible.every((t) => t.flag === null)).toBe(true)
    expect(visible.map((t) => t.key)).toContain('keep_photos_on_device')
  },
)

it('a build with flags on hides only the other platform’s toggles', () => {
  const visible = visiblePhotoToggles(FLAGS_ON, 'android')
  const hidden = PHOTO_TOGGLES.filter((t) => !visible.includes(t))
  expect(hidden.map((t) => t.platform)).toEqual(['ios'])
})
