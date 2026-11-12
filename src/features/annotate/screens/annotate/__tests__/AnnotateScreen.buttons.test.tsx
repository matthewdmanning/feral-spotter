import { act, userEvent, render, screen } from '@testing-library/react-native'
import { useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import React from 'react'
import { useAnnotatePass } from '@/src/features/annotate/hooks/useAnnotatePass'
import AnnotateScreen from '@/src/features/annotate/screens/annotate/index'
import { submissionPhoto } from '@/src/test-utils/photoFixtures'
import { styles as buttonRowStyles } from '@/src/shared/ui/molecules/ButtonRow.styles'
import type { TestInstance } from 'test-renderer'

/**
 * Button wiring on AnnotateScreen (src/features/annotate/screens/annotate/index.tsx)
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

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
}))

jest.mock('@/src/features/annotate/hooks/useAnnotatePass', () => ({
  useAnnotatePass: jest.fn(),
}))
jest.mock('@/src/shared/hooks/useBackHandler', () => ({
  useBackHandler: jest.fn(),
}))
jest.mock('@/src/features/annotate/hooks/useTutorialStore', () => ({
  useTutorialStore: (sel: (s: object) => unknown) =>
    sel({
      annotation_tutorial_status: 'unseen',
      setAnnotationTutorialStatus: jest.fn(),
    }),
}))
jest.mock('react-native-reanimated-carousel', () => 'Carousel')
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}))
jest.mock('@/src/features/annotate/components/AnnotateCarouselItem', () => ({
  AnnotateCarouselItem: () => null,
}))
jest.mock('@/src/features/annotate/components/InsetCropBubble', () => ({
  InsetCropBubble: () => null,
}))
jest.mock('@/src/features/annotate/components/TutorialOverlay', () => ({
  TutorialOverlay: () => null,
}))
const PHOTO = (id: string) =>
  submissionPhoto({ local_id: id, uri: id, width: 1, height: 1 })

const handleConfirmBox = jest.fn()
const handleNotInPhoto = jest.fn()
const handleBoxingComplete = jest.fn()
const clearActiveCat = jest.fn()
const handleAbandonPass = jest.fn()
const handlePrevPhoto = jest.fn()
const handleLongPressRemove = jest.fn()
const setCurrentIndex = jest.fn()

const layoutTarget = (instance: TestInstance): TestInstance => {
  if ('onLayout' in instance.props) return instance
  if (!instance.parent)
    throw new Error('No layout handler found above the label')
  return layoutTarget(instance.parent)
}

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
    jest.mocked(useWindowDimensions).mockReturnValue({
      fontScale: 1,
      scale: 1,
      width: 400,
      height: 800,
    })
    jest.spyOn(buttonRowStyles, 'useVariants')
  })

  it('empty photo pool: Go back clears the active cat and pops the screen', async () => {
    jest
      .mocked(useAnnotatePass)
      .mockReturnValue({ ...baseAnnotatePass, photos: [] })
    await render(<AnnotateScreen />)

    await userEvent.press(screen.getByText('Go back'))

    expect(clearActiveCat).toHaveBeenCalledTimes(1)
    expect(router.back).toHaveBeenCalledTimes(1)
  })

  it('first photo: Previous is disabled and does not call the handler', async () => {
    jest
      .mocked(useAnnotatePass)
      .mockReturnValue({ ...baseAnnotatePass, currentIndex: 0 })
    await render(<AnnotateScreen />)

    const prevButton = screen.getByText('← Previous')
    await userEvent.press(prevButton)

    expect(handlePrevPhoto).not.toHaveBeenCalled()
    // #375: the dead button must say why it is dead.
    expect(screen.getByText(/first photo/)).toBeTruthy()
  })

  it('second photo: Previous is enabled and calls handlePrevPhoto', async () => {
    jest
      .mocked(useAnnotatePass)
      .mockReturnValue({ ...baseAnnotatePass, currentIndex: 1 })
    await render(<AnnotateScreen />)

    await userEvent.press(screen.getByText('← Previous'))

    expect(handlePrevPhoto).toHaveBeenCalledTimes(1)
    // #375: no reason line while the button works.
    expect(screen.queryByText(/first photo/)).toBeNull()
  })

  it('Not in Photo calls handleNotInPhoto', async () => {
    jest.mocked(useAnnotatePass).mockReturnValue(baseAnnotatePass)
    await render(<AnnotateScreen />)

    await userEvent.press(screen.getByLabelText('Not in this photo'))

    expect(handleNotInPhoto).toHaveBeenCalledTimes(1)
  })

  it('Done With This Cat calls handleBoxingComplete', async () => {
    jest.mocked(useAnnotatePass).mockReturnValue(baseAnnotatePass)
    await render(<AnnotateScreen />)

    await userEvent.press(screen.getByText('Done With This Cat'))

    expect(handleBoxingComplete).toHaveBeenCalledTimes(1)
  })

  it('keeps all three actions in the adaptive row at narrow and wide measured widths', async () => {
    jest.mocked(useAnnotatePass).mockReturnValue({
      ...baseAnnotatePass,
      currentIndex: 1,
    })
    await render(<AnnotateScreen />)
    const row = layoutTarget(screen.getByText('← Previous'))

    await act(async () =>
      row.props.onLayout({
        nativeEvent: { layout: { width: 220, height: 120, x: 0, y: 0 } },
      }),
    )
    const calls = jest.mocked(buttonRowStyles.useVariants).mock.calls
    expect(calls[calls.length - 1][0]).toEqual({ stacked: true })

    await userEvent.press(screen.getByText('← Previous'))
    await userEvent.press(screen.getByLabelText('Not in this photo'))
    await userEvent.press(screen.getByText('Done With This Cat'))
    expect(handlePrevPhoto).toHaveBeenCalledTimes(1)
    expect(handleNotInPhoto).toHaveBeenCalledTimes(1)
    expect(handleBoxingComplete).toHaveBeenCalledTimes(1)

    await act(async () =>
      row.props.onLayout({
        nativeEvent: { layout: { width: 440, height: 52, x: 0, y: 0 } },
      }),
    )
    const resizedCalls = jest.mocked(buttonRowStyles.useVariants).mock.calls
    expect(resizedCalls[resizedCalls.length - 1][0]).toEqual({ stacked: false })
    expect(screen.getByText('← Previous')).toBeOnTheScreen()
    expect(screen.getByLabelText('Not in this photo')).toBeOnTheScreen()
    expect(screen.getByText('Done With This Cat')).toBeOnTheScreen()
  })

  it('long-pressing Remove photo calls handleLongPressRemove', async () => {
    jest.mocked(useAnnotatePass).mockReturnValue(baseAnnotatePass)
    await render(<AnnotateScreen />)

    await userEvent.longPress(screen.getByLabelText('Remove photo'))

    expect(handleLongPressRemove).toHaveBeenCalledTimes(1)
  })
})
