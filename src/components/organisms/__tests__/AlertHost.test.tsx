import { act, userEvent, render, screen } from '@testing-library/react-native'
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

it('runs the pressed button and closes', async () => {
  const onPress = jest.fn()
  render(<AlertHost />)

  act(() =>
    showAlert('Discard Changes', 'Discard all unsaved changes?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress },
    ]),
  )

  expect(screen.getByText('Discard all unsaved changes?')).toBeTruthy()
  await userEvent.press(screen.getByText('Discard'))

  expect(onPress).toHaveBeenCalledTimes(1)
  expect(dialog()).toBeNull()
})

it('leaves the second dialog standing when a handler chains one', async () => {
  render(<AlertHost />)

  act(() =>
    showAlert('First', undefined, [
      { text: 'Next', onPress: () => showAlert('Second') },
    ]),
  )
  await userEvent.press(screen.getByText('Next'))

  expect(dialog()?.title).toBe('Second')
  expect(screen.getByText('Second')).toBeOnTheScreen()
  expect(screen.queryByText('First')).not.toBeOnTheScreen()
})

it('dismisses a default OK dialog without a custom handler', async () => {
  render(<AlertHost />)
  act(() => showAlert('Submission Incomplete', 'Add at least one cat.'))

  await userEvent.press(screen.getByRole('button', { name: 'OK' }))

  expect(dialog()).toBeNull()
  expect(screen.queryByText('Add at least one cat.')).not.toBeOnTheScreen()
})
