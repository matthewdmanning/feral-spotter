import { BUTTON_ROW_STACK_FONT_SCALE } from '@/src/shared/config/constants'
import { render, screen } from '@testing-library/react-native'
import { Text, useWindowDimensions } from 'react-native'
import { ButtonRow } from '@/src/shared/ui/molecules/ButtonRow'
import { styles } from '@/src/shared/ui/molecules/ButtonRow.styles'

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}))

const setFontScale = (fontScale: number) =>
  jest.mocked(useWindowDimensions).mockReturnValue({
    fontScale,
    scale: 1,
    width: 400,
    height: 800,
  })

// The Unistyles jest mock does not resolve variants, so the stacked choice is
// read from the variant the row asks for.
const requestedVariants = () => {
  const calls = jest.mocked(styles.useVariants).mock.calls
  return calls[calls.length - 1][0]
}

beforeEach(() => {
  jest.spyOn(styles, 'useVariants')
})

// The failure this guards: at a large OS font size the buttons stay side by
// side and their labels clip, or a conditional child silently disappears.
it.each([
  { fontScale: 1, stacked: false },
  { fontScale: BUTTON_ROW_STACK_FONT_SCALE - 0.01, stacked: false },
  { fontScale: BUTTON_ROW_STACK_FONT_SCALE, stacked: true },
  { fontScale: 2, stacked: true },
])(
  'asks for stacked=$stacked at font scale $fontScale',
  ({ fontScale, stacked }) => {
    setFontScale(fontScale)
    render(
      <ButtonRow>
        <Text>Cancel</Text>
        <Text>Confirm</Text>
      </ButtonRow>,
    )

    expect(requestedVariants()).toEqual({ stacked })
    expect(screen.getByText('Cancel')).toBeOnTheScreen()
    expect(screen.getByText('Confirm')).toBeOnTheScreen()
  },
)

it('skips a falsy child without losing the others', () => {
  setFontScale(1)
  render(
    <ButtonRow>
      {false}
      <Text>Only</Text>
    </ButtonRow>,
  )

  expect(screen.getByText('Only')).toBeOnTheScreen()
})
