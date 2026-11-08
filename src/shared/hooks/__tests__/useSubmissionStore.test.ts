import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { observedCat } from '@/src/test-utils/catFixtures'

beforeEach(() => {
  useSubmissionStore.getState().clearDraft()
})

it('keeps a cat id stable when updating protected fields', () => {
  const cat = observedCat({ local_id: 'original' })
  useSubmissionStore.getState().addCat(cat)
  const edited = observedCat({ local_id: 'other', age: 'adult' })

  useSubmissionStore.getState().updateCat('original', edited)

  expect(useSubmissionStore.getState().cats[0]).toMatchObject({
    local_id: 'original',
    age: 'adult',
  })
})

it('clears stale EXIF time when switching to manual time and vice versa', () => {
  const store = useSubmissionStore.getState()
  store.setManualTime('2026-01-01T00:00:00.000Z')
  store.setLibraryTime({
    time_type: 'device',
    captured_at: '2026-01-02T00:00:00.000Z',
  })
  expect(useSubmissionStore.getState().submission).toMatchObject({
    time_type: 'device',
    captured_at: '2026-01-02T00:00:00.000Z',
  })
  expect(useSubmissionStore.getState().submission.manual_time).toBeUndefined()

  store.setManualTime('2026-01-03T00:00:00.000Z')
  expect(useSubmissionStore.getState().submission).toMatchObject({
    time_type: 'manual',
    manual_time: '2026-01-03T00:00:00.000Z',
  })
  expect(useSubmissionStore.getState().submission.captured_at).toBeUndefined()
})

it('retains manual time across repeated library picks and clears it for EXIF time', () => {
  const store = useSubmissionStore.getState()
  store.setLibraryTime({ time_type: 'manual' })
  store.setManualTime('2026-01-04T00:00:00.000Z')
  store.setLibraryTime({ time_type: 'manual' })
  expect(useSubmissionStore.getState().submission.manual_time).toBe(
    '2026-01-04T00:00:00.000Z',
  )

  store.setLibraryTime({
    time_type: 'device',
    captured_at: '2026-01-05T00:00:00.000Z',
  })
  expect(useSubmissionStore.getState().submission.manual_time).toBeUndefined()
  expect(useSubmissionStore.getState().submission.captured_at).toBe(
    '2026-01-05T00:00:00.000Z',
  )
})

it('rejects a sharing draft after the current submission has been cleared', () => {
  const store = useSubmissionStore.getState()
  store.setSubmissionLocation({ latitude: 1, longitude: 1 })
  const draft = {
    ownerUid: 'owner',
    selectedIds: ['rescue'],
    anonymous: true,
    catalogVersion: 'v1',
    confirmedSignature: null,
  }
  store.setOrganizationSharing(draft)
  expect(useSubmissionStore.getState().organizationSharing).toEqual(draft)

  store.clearDraft()
  store.setOrganizationSharing(draft)
  expect(useSubmissionStore.getState().organizationSharing).toBeNull()
})

it('invalidates restored confirmation even for a legacy draft without a location', async () => {
  useSubmissionStore.setState({
    organizationSharing: {
      ownerUid: 'owner',
      selectedIds: ['rescue'],
      anonymous: true,
      catalogVersion: 'v1',
      confirmedSignature: 'previous-session',
    },
  })

  await useSubmissionStore.persist.rehydrate()

  expect(useSubmissionStore.getState().organizationSharing).toMatchObject({
    selectedIds: ['rescue'],
    confirmedSignature: null,
  })
})
