import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AlertHost } from '../AlertHost'
import { showAlert, useUIStore } from '@/src/hooks/useUIStore'

/**
 * AlertHost replaced Alert.alert, so the behaviours the native alert gave
 * for free are now ours to keep: a button's handler runs, the dialog closes
 * itself, and a handler that raises the *next* dialog isn't wiped by that
 * close (the submit flow chains two).
 */

const dialog = () => useUIStore.getState().dialog

beforeEach(() => {
  useUIStore.setState({ dialog: null })
})

it('draws nothing until a dialog is raised', () => {
  render(<AlertHost />)
  expect(screen.queryByText('Discard Changes')).toBeNull()
})

it('runs the pressed button and closes', () => {
  const onPress = jest.fn()
  render(<AlertHost />)

  act(() =>
    showAlert('Discard Changes', 'Discard all unsaved changes?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress },
    ]),
  )

  expect(screen.getByText('Discard all unsaved changes?')).toBeTruthy()
  fireEvent.press(screen.getByText('Discard'))

  expect(onPress).toHaveBeenCalledTimes(1)
  expect(dialog()).toBeNull()
})

it('leaves the second dialog standing when a handler chains one', () => {
  render(<AlertHost />)

  act(() =>
    showAlert('First', undefined, [
      { text: 'Next', onPress: () => showAlert('Second') },
    ]),
  )
  fireEvent.press(screen.getByText('Next'))

  expect(dialog()?.title).toBe('Second')
})

it('defaults to a single OK, as Alert.alert does', () => {
  render(<AlertHost />)
  act(() => showAlert('Submission Incomplete', 'Add at least one cat.'))
  expect(screen.getByText('OK')).toBeTruthy()
})
