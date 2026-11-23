import { render, screen, userEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'

test('long action labels wrap inside a touch target and remain pressable', async () => {
  const label = `Revoke all access for ${'Neighborhood rescue '.repeat(8)}`
  const onPress = jest.fn()
  await render(<TextButton onPress={onPress}>{label}</TextButton>)

  const button = screen.getByRole('button', { name: label })
  const text = screen.getByText(label)
  expect(text).toHaveStyle({ flexShrink: 1 })
  expect(text.props.numberOfLines).toBeUndefined()
  expect(
    StyleSheet.flatten(button.props.style).minHeight,
  ).toBeGreaterThanOrEqual(48)
  expect(button).toBeEnabled()

  await userEvent.setup().press(button)
  expect(onPress).toHaveBeenCalledTimes(1)
})
