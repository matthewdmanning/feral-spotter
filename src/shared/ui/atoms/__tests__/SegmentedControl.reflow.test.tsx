import { render, screen, userEvent } from '@testing-library/react-native'
import { StyleSheet, useWindowDimensions } from 'react-native'
import { useState } from 'react'
import { SegmentedControl } from '@/src/shared/ui/atoms/SegmentedControl'

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}))

function Harness() {
  const [value, setValue] = useState<string | undefined>()
  return (
    <SegmentedControl
      label="Coat"
      value={value}
      onChange={setValue}
      options={[
        { value: 'bicolor', label: 'Bicolor & Piebald' },
        { value: 'solid', label: 'Solid' },
      ]}
    />
  )
}

// Renderer evidence for wrapping/selection contracts, not a native layout measurement.
it.each([1, 2, 3])(
  'retains complete choices and selection at font scale %s',
  async (fontScale) => {
    jest
      .mocked(useWindowDimensions)
      .mockReturnValue({ width: 320, height: 640, scale: 1, fontScale })
    await render(<Harness />)
    const label = screen.getByText('Bicolor & Piebald')
    expect(label.props.numberOfLines).toBeUndefined()
    const button = screen.getByRole('button', { name: 'Bicolor & Piebald' })
    expect(
      StyleSheet.flatten(button.props.style).minHeight,
    ).toBeGreaterThanOrEqual(48)
    await userEvent.press(button)
    expect(button).toBeSelected()
    await userEvent.press(button)
    expect(button).not.toBeSelected()
  },
)
