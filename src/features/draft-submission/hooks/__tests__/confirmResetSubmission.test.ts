import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSettingsStore } from '@/src/features/settings/hooks/useSettingsStore'
import { useUIStore } from '@/src/shared/hooks/useUIStore'
import {
  confirmResetSubmission,
  confirmStartNewSighting,
} from '@/src/features/draft-submission/hooks/confirmResetSubmission'
import { discardDraft } from '@/src/features/draft-submission/lib/draft'
import { router } from 'expo-router'

/**
 * Reset never deletes camera-roll copies, so its dialog must say they stay
 * exactly when "Keep Photos on Device" saved some. Real stores.
 */

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), dismissTo: jest.fn() },
}))
jest.mock('@/src/features/draft-submission/lib/draft', () => ({
  discardDraft: jest.fn(),
  discardUnsurvivingDraft: jest.fn().mockResolvedValue(undefined),
  isDraftBusy: () => false,
}))

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

describe('confirmStartNewSighting', () => {
  beforeEach(() => {
    usePhotoStore.setState(usePhotoStore.getInitialState(), true)
    jest.mocked(discardDraft).mockResolvedValue(true)
  })

  it('clears the draft and remounts Home only after Start New', async () => {
    seedPhotos('library')
    confirmStartNewSighting()
    const dialog = useUIStore.getState().dialog
    expect(dialog?.title).toBe('Start a New Sighting?')
    expect(discardDraft).not.toHaveBeenCalled()
    await dialog?.buttons.find((b) => b.text === 'Start New')?.onPress?.()
    expect(discardDraft).toHaveBeenCalledTimes(1)
    expect(router.dismissTo).toHaveBeenCalledWith('/')
  })
})
