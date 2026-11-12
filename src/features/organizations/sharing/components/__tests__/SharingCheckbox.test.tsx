import { render, screen, userEvent } from '@testing-library/react-native'
import { UnistylesRuntime } from 'react-native-unistyles'
import { SharingCheckbox } from '@/src/features/organizations/sharing/components/SharingCheckbox'

test('checked control uses the semantic icon color, bounded size, and toggles accessibly', async () => {
  const onChange = jest.fn()
  const rendered = await render(
    <SharingCheckbox label="Photos" checked onChange={onChange} />,
  )

  const checkbox = screen.getByRole('checkbox', { name: 'Photos' })
  expect(checkbox).toBeChecked()
  const theme = UnistylesRuntime.getTheme()
  const mark = rendered.root?.queryAll(
    (instance) =>
      instance.props.color === theme.colors.accentText &&
      instance.props.width === theme.iconSize.sm &&
      instance.props.height === theme.iconSize.sm,
  )[0]
  if (!mark) throw new Error('checked icon was not rendered')
  expect(mark.props.color).toBe(theme.colors.accentText)
  expect(mark.props.width).toBe(theme.iconSize.sm)
  expect(mark.props.height).toBe(theme.iconSize.sm)

  await userEvent.setup().press(checkbox)
  expect(onChange).toHaveBeenCalledWith(false)
})
