import { render, screen, userEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { AppButton } from '../AppButton'

it.each([
  { disabled: true, loading: false },
  { disabled: false, loading: true },
])(
  'prevents presses while %p, then allows a press when ready',
  async (props) => {
    const user = userEvent.setup()
    const onPress = jest.fn()
    const { rerender } = render(
      <AppButton {...props} onPress={onPress}>
        Submit
      </AppButton>,
    )

    const button = screen.getByRole('button', { name: 'Submit' })
    expect(button).toBeDisabled()
    await user.press(button)
    expect(onPress).not.toHaveBeenCalled()

    rerender(<AppButton onPress={onPress}>Submit</AppButton>)
    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled()
    await user.press(screen.getByRole('button', { name: 'Submit' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  },
)

it('keeps the shared button touch target at least 48dp tall', () => {
  render(<AppButton onPress={jest.fn()}>Continue</AppButton>)

  const style = StyleSheet.flatten(screen.getByRole('button').props.style)
  expect(style.minHeight).toBeGreaterThanOrEqual(48)
})
