import { render } from '@testing-library/react-native'
import React from 'react'
import { StatusIcon } from '@/src/components/atoms/StatusIcon'
import type { CacheStatus } from '@/src/lib/cache/submissionCache'

jest.mock('react-native-unistyles', () => {
  const anyProp = (): unknown => new Proxy({}, { get: (_t, _k) => anyProp() })
  const theme = new Proxy({}, { get: (_t, _k) => anyProp() })
  return {
    useUnistyles: () => ({ theme }),
    createStyleSheet: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn),
    StyleSheet: { create: (fn: unknown) => (typeof fn === 'function' ? fn(theme) : fn) },
  }
})

jest.mock('lucide-react-native', () => {
  const { Text: RNText } = require('react-native')
  const iconStub =
    (name: string) =>
    ({ testID = name }: { testID?: string }) => <RNText testID={testID} />
  return {
    CheckCircle: iconStub('CheckCircle'),
    Clock: iconStub('Clock'),
    Send: iconStub('Send'),
    XCircle: iconStub('XCircle'),
  }
})

describe('StatusIcon', () => {
  it.each<[CacheStatus, string]>([
    ['In Progress', 'Clock'],
    ['Sending', 'Send'],
    ['Submitted', 'CheckCircle'],
    ['Failed', 'XCircle'],
  ])('renders the %s icon for status "%s"', (status, expectedTestId) => {
    const { getByTestId } = render(<StatusIcon status={status} />)
    expect(getByTestId(expectedTestId)).toBeTruthy()
  })

  it('renders nothing for an unrecognized status (defensive default case)', () => {
    const { toJSON } = render(
      <StatusIcon status={'Unknown' as unknown as CacheStatus} />,
    )
    expect(toJSON()).toBeNull()
  })
})
