// ponytail: real FlashList needs jest.config.js to transform it, which may slow Jest loading; mock it if that bites.
import '@shopify/flash-list/jestSetup'
import {
  getAllSubmissionCaches,
  type SubmissionCacheFile,
} from '@/src/lib/cache/submissionCache'
import { render, screen } from '@testing-library/react-native'
import FeralReportsScreen from '../index'

// Stack.Screen needs a navigator; only the header options live there.
jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }))
jest.mock('@/src/lib/cache/submissionCache', () => ({
  ...jest.requireActual('@/src/lib/cache/submissionCache'),
  getAllSubmissionCaches: jest.fn(),
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

const showCaches = (caches: SubmissionCacheFile[]) =>
  jest.mocked(getAllSubmissionCaches).mockResolvedValue(caches)

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
})
