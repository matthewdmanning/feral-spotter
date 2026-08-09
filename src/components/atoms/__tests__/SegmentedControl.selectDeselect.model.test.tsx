import { render, fireEvent } from '@testing-library/react-native'
import React, { useState } from 'react'
import { createMachine } from 'xstate'
import { createTestModel } from '@xstate/graph'
import { SegmentedControl } from '../SegmentedControl'

jest.mock('react-native-unistyles', () => {
  const anyProp = (): unknown => new Proxy({}, { get: (_t, _k) => anyProp() })
  const theme = new Proxy({}, { get: (_t, _k) => anyProp() })
  const withVariants = (obj: object) =>
    Object.assign(obj, { useVariants: jest.fn() })
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: unknown) =>
        withVariants(typeof fn === 'function' ? fn(theme) : fn),
    },
  }
})

jest.mock('../SegmentedControl.styles', () => ({
  styles: new Proxy({}, { get: () => ({}) }),
}))

/**
 * Model of the toggle-to-deselect behavior added for #205: a segmented
 * control starts with no option selected, tapping an option selects it,
 * and tapping the already-selected option clears the selection back to
 * unselected — it never gets "stuck" selected.
 */
const options = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
]

function ControlledSegmentedControl() {
  const [value, setValue] = useState<string | undefined>(undefined)
  return (
    <SegmentedControl
      label="Test"
      options={options}
      value={value}
      onChange={setValue}
    />
  )
}

const toggleMachine = createMachine({
  id: 'segmentedControlToggle',
  initial: 'unselected',
  states: {
    unselected: { on: { TAP_A: 'selectedA', TAP_B: 'selectedB' } },
    selectedA: { on: { TAP_A: 'unselected', TAP_B: 'selectedB' } },
    selectedB: { on: { TAP_B: 'unselected', TAP_A: 'selectedA' } },
  },
})

describe('SegmentedControl select/deselect — model-based test', () => {
  let getByLabelText: ReturnType<typeof render>['getByLabelText']

  beforeEach(() => {
    const result = render(<ControlledSegmentedControl />)
    getByLabelText = result.getByLabelText
  })

  const model = createTestModel(toggleMachine)

  const expectSelected = (a: boolean, b: boolean) => {
    expect(getByLabelText('A').props.accessibilityState.selected).toBe(a)
    expect(getByLabelText('B').props.accessibilityState.selected).toBe(b)
  }

  const testParams = {
    states: {
      unselected: () => expectSelected(false, false),
      selectedA: () => expectSelected(true, false),
      selectedB: () => expectSelected(false, true),
    },
    events: {
      TAP_A: () => fireEvent.press(getByLabelText('A')),
      TAP_B: () => fireEvent.press(getByLabelText('B')),
    },
  }

  const journeys = [
    { name: 'fresh control has nothing selected', events: [] },
    { name: 'tapping an option selects it', events: [{ type: 'TAP_A' }] },
    {
      name: 'tapping the selected option deselects it',
      events: [{ type: 'TAP_A' }, { type: 'TAP_A' }],
    },
    {
      name: 'tapping a different option switches selection',
      events: [{ type: 'TAP_A' }, { type: 'TAP_B' }],
    },
    {
      name: 'select, deselect, then select the other option',
      events: [{ type: 'TAP_A' }, { type: 'TAP_A' }, { type: 'TAP_B' }],
    },
  ] as const

  journeys.forEach(({ name, events }) => {
    it(name, async () => {
      const [path] = model.getPathsFromEvents(events)
      await path.test(testParams)
    })
  })
})
