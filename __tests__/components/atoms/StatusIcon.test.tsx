import { render } from '@testing-library/react-native'
import React from 'react'
import { StatusIcon } from '@/src/components/atoms/StatusIcon'
import type { CacheStatus } from '@/src/lib/cache/submissionCache'

// The real Phosphor icons render here. Each one sets a default testID of
// `phosphor-react-native-<name>-<weight prop>`, so the name identifies the icon
// drawn. The weight part reads "undefined" when no weight prop is passed.
describe('StatusIcon', () => {
  it.each<[CacheStatus, string]>([
    ['In Progress', 'clock'],
    ['Sending', 'paper-plane-right'],
    ['Submitted', 'check-circle'],
    ['Failed', 'x-circle'],
  ])('renders the %s icon for status "%s"', (status, iconName) => {
    const { getByTestId } = render(<StatusIcon status={status} />)
    expect(
      getByTestId(new RegExp(`^phosphor-react-native-${iconName}-`)),
    ).toBeTruthy()
  })
})
