/**
 * Experimental camera tuning must never reach a release build. This reads
 * the real toggle list, so a new dev toggle added without `devOnly: true`
 * fails here instead of shipping.
 */

import { PHOTO_TOGGLES, visiblePhotoToggles } from '../photoToggles'

it.each(['android', 'ios'])(
  'a release build on %s shows only the non-dev toggles for it',
  (os) => {
    const visible = visiblePhotoToggles(false, os)
    expect(visible.every((t) => !t.devOnly)).toBe(true)
    expect(visible.map((t) => t.key)).toContain('keep_photos_on_device')
  },
)

it('a dev build hides only the other platform’s toggles', () => {
  const visible = visiblePhotoToggles(true, 'android')
  const hidden = PHOTO_TOGGLES.filter((t) => !visible.includes(t))
  expect(hidden.map((t) => t.platform)).toEqual(['ios'])
})
