import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import { useUIStore } from '@/src/hooks/useUIStore'
import { confirmResetSubmission } from '../confirmResetSubmission'

/**
 * Reset never deletes camera-roll copies, so its dialog must say they stay
 * exactly when "Keep Photos on Device" saved some. Real stores.
 */

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }))
jest.mock('@/src/lib/submission/draft', () => ({ discardDraft: jest.fn() }))

const seedPhotos = (source: 'camera' | 'library') =>
  usePhotoStore.setState({
    photos: [
      {
        local_id: 'photo-1',
        uri: 'file:///photo-1.jpg',
        uploaded: false,
        upload_progress: 0,
        width: 100,
        height: 100,
      },
    ],
    source,
  })

const dialogMessage = () => {
  confirmResetSubmission()
  return useUIStore.getState().dialog?.message
}

describe('confirmResetSubmission dialog', () => {
  beforeEach(() => {
    usePhotoStore.setState(usePhotoStore.getInitialState(), true)
    useSettingsStore.getState().updateSetting('keep_photos_on_device', true)
  })

  it('says camera-roll copies stay when camera photos were kept', () => {
    seedPhotos('camera')
    expect(dialogMessage()).toContain('camera roll stay there')
  })

  it('stays silent about the camera roll when the setting is off', () => {
    useSettingsStore.getState().updateSetting('keep_photos_on_device', false)
    seedPhotos('camera')
    expect(dialogMessage()).not.toContain('camera roll')
  })

  it('stays silent about the camera roll for library photos', () => {
    seedPhotos('library')
    expect(dialogMessage()).not.toContain('camera roll')
  })
})
