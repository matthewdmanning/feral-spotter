import { render, screen } from '@testing-library/react-native'
import { UnistylesRuntime } from 'react-native-unistyles'
import { SharingCheckbox } from '../SharingCheckbox'

// Guard against using a page background as the selected control's foreground,
// and against a font-scaled glyph clipping inside the fixed checkbox frame.
test('a checked control uses the on-accent icon color and bounded icon size', () => {
  render(<SharingCheckbox label="Photos" checked onChange={jest.fn()} />)
  const theme = UnistylesRuntime.getTheme()
  const mark = screen.getByTestId('phosphor-react-native-check-bold')
  expect(mark.props.color).toBe(theme.colors.accentText)
  expect(mark.props.width).toBe(theme.iconSize.sm)
  expect(mark.props.height).toBe(theme.iconSize.sm)
  expect(screen.getByRole('checkbox', { name: 'Photos' })).toBeChecked()
})
