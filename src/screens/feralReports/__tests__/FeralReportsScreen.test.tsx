import '@shopify/flash-list/jestSetup'
import type { SubmissionCacheFile } from '@/src/lib/cache/submissionCache'
import { useFeralReports } from '@/src/hooks/useFeralReports'
import { SightingsMap } from '@/src/components/organisms/SightingsMap'
import { FlashList } from '@shopify/flash-list'
import { router } from 'expo-router'
import { act, render, screen, userEvent } from '@testing-library/react-native'
import FeralReportsScreen from '../index'

// Stack.Screen needs a navigator; only the header options live there.
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { push: jest.fn() },
}))
// Focus this check on list/card wiring; the history rules have their own suite.
jest.mock('@/src/hooks/useFeralReports')
// Native map gestures and markers are driven through the map's screen contract.
jest.mock('@/src/components/organisms/SightingsMap', () => ({
  SightingsMap: jest.fn(() => null),
}))

const cache = (
  id: string,
  status: SubmissionCacheFile['status'],
  catCount: number,
) =>
  ({
    id,
    created_at: '2026-10-01T12:00:00.000Z',
    updated_at: '2026-10-01T12:00:00.000Z',
    status,
    metadata: {},
    cats: Array.from({ length: catCount }, (_, i) => ({ local_id: `c${i}` })),
  }) as unknown as SubmissionCacheFile

const showCaches = (caches: SubmissionCacheFile[], resumableId?: string) =>
  jest.mocked(useFeralReports).mockReturnValue({
    caches,
    spots: [],
    resumableId,
    refreshing: false,
    load: jest.fn(),
    onRefresh: jest.fn(),
  })

// The failure this guards: the title row, legend and empty state now live in
// the list's own header and empty slots, so a list change can drop one of
// them (or the cards) without any other test noticing.
describe('Feral Reports screen', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows the empty state and no legend before any report exists', async () => {
    showCaches([])
    render(<FeralReportsScreen />)

    expect(await screen.findByText('No reports yet')).toBeOnTheScreen()
    expect(screen.getByText('0 total')).toBeOnTheScreen()
    expect(screen.queryByText('Failed')).not.toBeOnTheScreen()
  })

  it('lists each report with the legend and the total, and no empty state', async () => {
    showCaches([cache('a', 'Submitted', 2), cache('b', 'Failed', 0)])
    render(<FeralReportsScreen />)

    expect(await screen.findByText('2 total')).toBeOnTheScreen()
    expect(screen.getByText('Cats: 2')).toBeOnTheScreen()
    expect(screen.getByText('None')).toBeOnTheScreen()
    // Legend labels plus each card's own status text.
    expect(screen.getAllByText('Submitted').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('In Progress')).toBeOnTheScreen()
    expect(screen.queryByText('No reports yet')).not.toBeOnTheScreen()
  })

  it('keeps map gestures, pin navigation and changing draft actions wired through the recycled list', async () => {
    const user = userEvent.setup()
    const caches = [
      cache('sent', 'Submitted', 2),
      cache('draft', 'In Progress', 1),
    ]
    showCaches(caches, 'draft')
    const { rerender } = render(<FeralReportsScreen />)

    await user.press(
      screen.getByRole('button', { name: /Sighting, Submitted/ }),
    )
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/sighting/[id]',
      params: { id: 'sent' },
    })
    await user.press(
      screen.getByRole('button', { name: /Sighting, In Progress/ }),
    )
    expect(router.push).toHaveBeenLastCalledWith('/submission/create')

    // The cache array stays identical: only the resume target changes.
    // A memoized card/list must still stop offering the abandoned draft.
    showCaches(caches)
    rerender(<FeralReportsScreen />)
    expect(
      screen.queryByRole('button', { name: /Sighting, In Progress/ }),
    ).toBeNull()
    expect(screen.getByText('Cats: 1')).toBeOnTheScreen()

    const mapProps = () => jest.mocked(SightingsMap).mock.calls.at(-1)![0]
    act(() => mapProps().onTouchActiveChange?.(true))
    expect(screen.UNSAFE_getByType(FlashList).props.scrollEnabled).toBe(false)
    act(() => mapProps().onTouchActiveChange?.(false))
    expect(screen.UNSAFE_getByType(FlashList).props.scrollEnabled).toBe(true)
    act(() =>
      mapProps().onSpotPress({
        id: 'spot',
        latitude: 34,
        longitude: -82,
        catCount: 3,
        sightingIds: ['newest', 'older'],
      }),
    )
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/sighting/[id]',
      params: { id: 'newest' },
    })
  })
})
