import { render, screen } from '@testing-library/react-native'
import { TextButton } from '../TextButton'

// Organization names can be long; a row label must be allowed to shrink and
// wrap instead of extending past the padded card edge at large text sizes.
test('long action labels can wrap inside their touch target', () => {
  const label = `Revoke all access for ${'Neighborhood rescue '.repeat(8)}`
  render(<TextButton onPress={jest.fn()}>{label}</TextButton>)
  expect(screen.getByText(label)).toHaveStyle({ flexShrink: 1 })
  expect(screen.getByRole('button', { name: label })).toBeEnabled()
})
