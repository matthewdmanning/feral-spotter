import { BUTTON_ROW_STACK_FONT_SCALE } from '@/src/shared/config/constants'
import { act, render, screen, userEvent } from '@testing-library/react-native'
import { Text, useWindowDimensions } from 'react-native'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { ButtonRow } from '@/src/shared/ui/molecules/ButtonRow'
import { styles } from '@/src/shared/ui/molecules/ButtonRow.styles'
import type { TestInstance } from 'test-renderer'

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

const layoutTarget = (instance: TestInstance): TestInstance => {
  if ('onLayout' in instance.props) return instance
  if (!instance.parent)
    throw new Error('No layout handler found above the label')
  return layoutTarget(instance.parent)
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
  async ({ fontScale, stacked }) => {
    setFontScale(fontScale)
    await render(
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

it('skips a falsy child without losing the others', async () => {
  setFontScale(1)
  await render(
    <ButtonRow>
      {false}
      <Text>Only</Text>
    </ButtonRow>,
  )

  expect(screen.getByText('Only')).toBeOnTheScreen()
})

it('stacks measured narrow rows and keeps both actions usable when wide', async () => {
  setFontScale(1)
  const cancel = jest.fn()
  const confirm = jest.fn()
  await render(
    <ButtonRow>
      <AppButton onPress={cancel}>Cancel</AppButton>
      <AppButton onPress={confirm}>Confirm</AppButton>
    </ButtonRow>,
  )

  const layoutView = layoutTarget(screen.getByText('Cancel'))
  await act(async () =>
    layoutView.props.onLayout({
      nativeEvent: { layout: { width: 220, height: 52, x: 0, y: 0 } },
    }),
  )
  expect(requestedVariants()).toEqual({ stacked: true })
  await userEvent.press(screen.getByRole('button', { name: 'Cancel' }))
  await userEvent.press(screen.getByRole('button', { name: 'Confirm' }))
  expect(cancel).toHaveBeenCalledTimes(1)
  expect(confirm).toHaveBeenCalledTimes(1)

  await act(async () =>
    layoutView.props.onLayout({
      nativeEvent: { layout: { width: 400, height: 52, x: 0, y: 0 } },
    }),
  )
  expect(requestedVariants()).toEqual({ stacked: false })
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeOnTheScreen()
})
