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

  // Documents intent, not a regression guard: a switch with no matching
  // case already returns `undefined`, which React renders the same as
  // `null`, so this passes with or without the explicit default branch.
  // The `default-case` lint rule (eslint.config.js) is what actually
  // enforces the branch exists; this only confirms the rendered output.
  it('renders nothing for an unrecognized status', () => {
    const { toJSON } = render(
      <StatusIcon status={'Unknown' as unknown as CacheStatus} />,
    )
    expect(toJSON()).toBeNull()
  })
})
