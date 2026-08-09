import { fireEvent, render, screen } from '@testing-library/react-native'
import { router } from 'expo-router'
import React from 'react'
import { useAnnotatePass } from '@/src/hooks/useAnnotatePass'
import AnnotateScreen from '../index'

/**
 * Button wiring on AnnotateScreen (src/screens/submission/annotate/index.tsx)
 * — mechanical onPress -> handler checks, not a stateful flow, so plain
 * cases rather than an xstate model (the actual flows these handlers drive
 * are modeled at the hook layer: useAnnotatePass.carouselNav.model.test.ts,
 * useActiveCatFlow.model.test.ts). useAnnotatePass is mocked wholesale here
 * — its own behavior is covered directly, this file only proves the screen
 * calls the right handler and reflects isFirst in the Previous button's
 * disabled state. Carousel/InsetCropBubble/TutorialOverlay are mocked away:
 * the carousel only mounts after an onLayout measurement react-test-renderer
 * never fires, and the other two are covered by their own tests
 * (InsetCropBubble.collapseFlow.model.test.tsx) or are unreachable in this
 * dev version (tutorial is version-gated past the current app version).
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

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
}))

jest.mock('react-native-unistyles', () => {
  const anyProp = (): unknown => new Proxy({}, { get: (_t, _k) => anyProp() })
  const theme = new Proxy({}, { get: (_t, _k) => anyProp() })
  return { useUnistyles: () => ({ theme }) }
})

jest.mock('../index.styles', () => ({
  styles: new Proxy({}, { get: () => ({}) }),
}))

jest.mock('@/src/hooks/useAnnotatePass', () => ({ useAnnotatePass: jest.fn() }))
jest.mock('@/src/hooks/useBackHandler', () => ({ useBackHandler: jest.fn() }))
jest.mock('@/src/hooks/useTutorialStore', () => ({
  useTutorialStore: (sel: (s: object) => unknown) =>
    sel({
      annotation_tutorial_status: 'unseen',
      setAnnotationTutorialStatus: jest.fn(),
    }),
}))
jest.mock('react-native-reanimated-carousel', () => 'Carousel')
jest.mock('@/src/components/organisms/AnnotateCarouselItem', () => ({
  AnnotateCarouselItem: () => null,
}))
jest.mock('@/src/components/organisms/InsetCropBubble', () => ({
  InsetCropBubble: () => null,
}))
jest.mock('@/src/components/organisms/TutorialOverlay', () => ({
  TutorialOverlay: () => null,
}))
jest.mock('lucide-react-native', () => ({ Trash2: () => null }))

const PHOTO = (id: string) => ({
  local_id: id,
  uri: id,
  uploaded: false,
  upload_progress: 0,
  width: 1,
  height: 1,
})

const handleConfirmBox = jest.fn()
const handleNotInPhoto = jest.fn()
const handleBoxingComplete = jest.fn()
const clearActiveCat = jest.fn()
const handleAbandonPass = jest.fn()
const handlePrevPhoto = jest.fn()
const handleLongPressRemove = jest.fn()
const setCurrentIndex = jest.fn()

const baseAnnotatePass: ReturnType<typeof useAnnotatePass> = {
  photos: [PHOTO('photo-1'), PHOTO('photo-2')],
  activeCatId: null,
  getPhotoStatus: () => 'pending',
  currentIndex: 0,
  setCurrentIndex,
  carouselRef: { current: null },
  handleConfirmBox,
  handleNotInPhoto,
  handleBoxingComplete,
  clearActiveCat,
  handleAbandonPass,
  handlePrevPhoto,
  handleLongPressRemove,
}

describe('AnnotateScreen buttons', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('empty photo pool: Go back clears the active cat and pops the screen', () => {
    jest
      .mocked(useAnnotatePass)
      .mockReturnValue({ ...baseAnnotatePass, photos: [] })
    render(<AnnotateScreen />)

    fireEvent.press(screen.getByText('Go back'))

    expect(clearActiveCat).toHaveBeenCalledTimes(1)
    expect(router.back).toHaveBeenCalledTimes(1)
  })

  it('first photo: Previous is disabled and does not call the handler', () => {
    jest
      .mocked(useAnnotatePass)
      .mockReturnValue({ ...baseAnnotatePass, currentIndex: 0 })
    render(<AnnotateScreen />)

    const prevButton = screen.getByText('← Previous')
    fireEvent.press(prevButton)

    expect(handlePrevPhoto).not.toHaveBeenCalled()
  })

  it('second photo: Previous is enabled and calls handlePrevPhoto', () => {
    jest
      .mocked(useAnnotatePass)
      .mockReturnValue({ ...baseAnnotatePass, currentIndex: 1 })
    render(<AnnotateScreen />)

    fireEvent.press(screen.getByText('← Previous'))

    expect(handlePrevPhoto).toHaveBeenCalledTimes(1)
  })

  it('Not in Photo calls handleNotInPhoto', () => {
    jest.mocked(useAnnotatePass).mockReturnValue(baseAnnotatePass)
    render(<AnnotateScreen />)

    fireEvent.press(screen.getByLabelText('Not in this photo'))

    expect(handleNotInPhoto).toHaveBeenCalledTimes(1)
  })

  it('Boxing Complete calls handleBoxingComplete', () => {
    jest.mocked(useAnnotatePass).mockReturnValue(baseAnnotatePass)
    render(<AnnotateScreen />)

    fireEvent.press(screen.getByText('Boxing Complete'))

    expect(handleBoxingComplete).toHaveBeenCalledTimes(1)
  })

  it('long-pressing Remove photo calls handleLongPressRemove', () => {
    jest.mocked(useAnnotatePass).mockReturnValue(baseAnnotatePass)
    render(<AnnotateScreen />)

    fireEvent(screen.getByLabelText('Remove photo'), 'longPress')

    expect(handleLongPressRemove).toHaveBeenCalledTimes(1)
  })
})
