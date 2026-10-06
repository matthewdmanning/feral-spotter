import { useBoundingBoxStore } from '../useBoundingBoxStore'

/**
 * A cat's color is fixed for its life. The failure worth catching: removing
 * one cat recolors another, or a new cat takes a removed cat's color while
 * unused colors remain.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)
jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}))

const box = {
  lowerLeftX: 0.1,
  lowerLeftY: 0.6,
  upperRightX: 0.5,
  upperRightY: 0.2,
}
const colorOf = (catId: string) =>
  useBoundingBoxStore.getState().catColors[catId]

describe('useBoundingBoxStore cat colors', () => {
  beforeEach(() => useBoundingBoxStore.getState().clearAll())

  it('keeps each cat’s color when another cat is removed', () => {
    const { addBox, clearForCat } = useBoundingBoxStore.getState()
    addBox('a', 'p1', box)
    addBox('b', 'p1', box)
    const before = colorOf('b')
    clearForCat('a')
    expect(colorOf('b')).toBe(before)
  })

  it('gives each cat a distinct color and keeps it across its own boxes', () => {
    const { addBox, markAbsent } = useBoundingBoxStore.getState()
    addBox('a', 'p1', box)
    const first = colorOf('a')
    addBox('a', 'p2', box)
    markAbsent('a', 'p3')
    addBox('b', 'p1', box)
    expect(colorOf('a')).toBe(first)
    expect(colorOf('b')).not.toBe(first)
  })

  it('gives a new cat an unused color, not the removed cat’s', () => {
    const { addBox, clearForCat } = useBoundingBoxStore.getState()
    addBox('a', 'p1', box)
    const removed = colorOf('a')
    clearForCat('a')
    addBox('b', 'p1', box)
    expect(colorOf('b')).not.toBe(removed)
  })
})
