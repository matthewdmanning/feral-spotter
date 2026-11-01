import { fireEvent, render, screen } from '@testing-library/react-native'
import { useState } from 'react'
import { HierarchicalSegmentedControl } from '@/src/shared/ui/atoms/HierarchicalSegmentedControl'

const groups = [
  {
    value: 'tabby',
    label: 'Tabby',
    children: [{ value: 'spotted', label: 'Spotted' }],
  },
  {
    value: 'solid',
    label: 'Solid',
    children: [{ value: 'black', label: 'Black' }],
  },
]

const onChange = jest.fn()

function Harness() {
  const [group, setGroup] = useState<string | undefined>()
  const [value, setValue] = useState<string | undefined>()
  return (
    <HierarchicalSegmentedControl
      label="Coat and color"
      groups={groups}
      group={group}
      value={value}
      onChange={(g, v) => {
        onChange(g, v)
        setGroup(g)
        setValue(v)
      }}
    />
  )
}

describe('HierarchicalSegmentedControl', () => {
  beforeEach(() => onChange.mockClear())

  it('shows a group’s choices only once the group is chosen', () => {
    render(<Harness />)
    expect(screen.queryByText('Spotted')).toBeNull()

    fireEvent.press(screen.getByText('Tabby'))
    expect(screen.getByText('Spotted')).toBeTruthy()
  })

  it('drops the choice when another group is chosen, and clears on a second tap', () => {
    render(<Harness />)
    fireEvent.press(screen.getByText('Tabby'))
    fireEvent.press(screen.getByText('Spotted'))
    expect(onChange).toHaveBeenLastCalledWith('tabby', 'spotted')

    fireEvent.press(screen.getByText('Solid'))
    expect(onChange).toHaveBeenLastCalledWith('solid', undefined)

    fireEvent.press(screen.getByText('Solid'))
    expect(onChange).toHaveBeenLastCalledWith(undefined, undefined)
    expect(screen.queryByText('Black')).toBeNull()
  })
})
