import * as ui from '@/src/shared/hooks/useUIStore'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook } from '@testing-library/react-native'

import { useActiveCatFlowStore } from '@/src/features/draft-submission/hooks/useActiveCatFlowStore'
import { useAnnotatePass } from '../useAnnotatePass'
import { useBoundingBoxStore } from '@/src/features/draft-submission/hooks/useBoundingBoxStore'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSettingsStore } from '@/src/features/settings/hooks/useSettingsStore'

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }))

const PHOTO = {
  local_id: 'photo-1',
  uri: 'file:///photo-1.jpg',
  uploaded: false,
  upload_progress: 0,
  width: 100,
  height: 100,
}
const OTHER_PHOTO = {
  ...PHOTO,
  local_id: 'photo-2',
  uri: 'file:///photo-2.jpg',
}
const BOX = { lowerLeftX: 1, lowerLeftY: 1, upperRightX: 9, upperRightY: 9 }

const pressDialogButton = async (text: string) => {
  const button = ui.useUIStore
    .getState()
    .dialog?.buttons.find((b) => b.text === text)
  expect(button).toBeDefined()
  await act(async () => {
    ui.useUIStore.getState().dismissDialog()
    await button?.onPress?.()
  })
}

const expectFirstPhotoRemoved = () => {
  expect(usePhotoStore.getState().photos).toEqual([OTHER_PHOTO])
  const annotations = useBoundingBoxStore.getState()
  expect(annotations.getBoxesForPhoto(PHOTO.local_id)).toEqual([])
  expect(annotations.absences['absent-cat:photo-1']).toBeUndefined()
  expect(annotations.lastBoxes['active-cat:photo-1']).toBeUndefined()
  expect(annotations.getBoxesForPhoto(OTHER_PHOTO.local_id)).toEqual([
    expect.objectContaining({
      cat_id: 'active-cat',
      photo_local_id: 'photo-2',
    }),
  ])
}

describe('useAnnotatePass — handleLongPressRemove confirmation branching', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
    jest.spyOn(ui, 'showAlert')
    ui.useUIStore.setState({ dialog: null })
    useActiveCatFlowStore.getState().setActiveCatId('active-cat')
    useSettingsStore
      .getState()
      .updateSetting('skip_photo_remove_confirm', false)
    usePhotoStore.setState({
      photos: [PHOTO, OTHER_PHOTO],
      source: 'camera',
      submissionId: 'remove-confirm-submission',
    })
    const annotations = useBoundingBoxStore.getState()
    annotations.clearAll()
    annotations.addBox('active-cat', PHOTO.local_id, BOX)
    annotations.addBox('active-cat', PHOTO.local_id, BOX)
    annotations.addBox('other-cat', PHOTO.local_id, BOX)
    annotations.markAbsent('absent-cat', PHOTO.local_id)
    annotations.addBox('active-cat', OTHER_PHOTO.local_id, BOX)
  })

  it('skip-confirm on: removes immediately without an Alert', () => {
    useSettingsStore.getState().updateSetting('skip_photo_remove_confirm', true)
    const { result } = renderHook(() => useAnnotatePass())

    act(() => result.current.handleLongPressRemove())

    expect(ui.showAlert).not.toHaveBeenCalled()
    expectFirstPhotoRemoved()
  })

  it('skip-confirm off: Alert offers a 3rd "don\'t ask again" option', async () => {
    const { result } = renderHook(() => useAnnotatePass())
    act(() => result.current.handleLongPressRemove())

    expect(ui.useUIStore.getState().dialog).toEqual(
      expect.objectContaining({
        title: 'Remove photo from submission?',
        message: 'This cannot be undone.',
      }),
    )
    expect(ui.useUIStore.getState().dialog?.buttons.map((b) => b.text)).toEqual(
      ['Cancel', "Remove, don't ask again", 'Remove'],
    )
    expect(usePhotoStore.getState().photos).toEqual([PHOTO, OTHER_PHOTO])

    await pressDialogButton('Remove')

    expectFirstPhotoRemoved()
    expect(useSettingsStore.getState().settings.skip_photo_remove_confirm).toBe(
      false,
    )
  })

  it('pressing "Remove, don\'t ask again" persists the setting and removes', async () => {
    const { result } = renderHook(() => useAnnotatePass())
    act(() => result.current.handleLongPressRemove())

    await pressDialogButton("Remove, don't ask again")

    expectFirstPhotoRemoved()
    const stored = JSON.parse((await AsyncStorage.getItem('settings-store'))!)
    expect(stored.state.settings.skip_photo_remove_confirm).toBe(true)

    // The setting must affect the next real removal as well as this callback.
    jest.mocked(ui.showAlert).mockClear()
    act(() => result.current.handleLongPressRemove())
    expect(ui.showAlert).not.toHaveBeenCalled()
    expect(usePhotoStore.getState().photos).toEqual([])
    expect(useBoundingBoxStore.getState().getBoxesForPhoto('photo-2')).toEqual(
      [],
    )
  })

  it('pressing Cancel removes nothing', async () => {
    const before = useBoundingBoxStore.getState()
    const { result } = renderHook(() => useAnnotatePass())
    act(() => result.current.handleLongPressRemove())

    await pressDialogButton('Cancel')

    expect(usePhotoStore.getState().photos).toEqual([PHOTO, OTHER_PHOTO])
    expect(useBoundingBoxStore.getState().boxes).toEqual(before.boxes)
    expect(useBoundingBoxStore.getState().absences).toEqual(before.absences)
    expect(useBoundingBoxStore.getState().lastBoxes).toEqual(before.lastBoxes)
    expect(useSettingsStore.getState().settings.skip_photo_remove_confirm).toBe(
      false,
    )
  })
})
