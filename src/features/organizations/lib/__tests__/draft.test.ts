import { reconcileSharingDraft } from '@/src/features/organizations/lib/draft'

it('preserves confirmation across equivalent refreshes and resets it for changes', () => {
  const choices = {
    ownerUid: 'owner',
    preferredIds: ['a', 'a', 'missing'],
    catalogVersion: 'v1',
    organizations: [
      { id: 'a', name: 'Rescue A' },
      { id: 'b', name: 'Rescue B' },
    ],
  }
  const initial = reconcileSharingDraft(null, choices)
  expect(initial.selectedIds).toEqual(['a'])
  const confirmed = {
    ...initial,
    anonymous: false,
    confirmedSignature: 'accepted',
  }
  expect(
    reconcileSharingDraft(confirmed, {
      ...choices,
      organizations: [...choices.organizations].reverse(),
    }),
  ).toBe(confirmed)
  expect(
    reconcileSharingDraft(confirmed, {
      ...choices,
      organizations: [{ id: 'b', name: 'Rescue B' }],
    }),
  ).toMatchObject({ selectedIds: [], confirmedSignature: null })
  expect(
    reconcileSharingDraft(confirmed, { ...choices, catalogVersion: 'v2' }),
  ).toMatchObject({ confirmedSignature: null })
  expect(
    reconcileSharingDraft(confirmed, {
      ...choices,
      ownerUid: 'other',
      preferredIds: [],
    }),
  ).toMatchObject({
    ownerUid: 'other',
    selectedIds: [],
    anonymous: true,
    confirmedSignature: null,
  })
})
