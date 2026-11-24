import { render, screen } from '@testing-library/react-native'
import React from 'react'
import CreateSubmissionScreen from '@/src/features/draft-submission/screens/create/index'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { observedCat } from '@/src/test-utils/catFixtures'
import { submissionCopy } from '@/src/shared/config/text'

// LOGIC-1: a manual-time draft with no time chosen used to show today's date
// in the picker, so an unset time read as set and was submitted as "now".

jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useLocalSearchParams: () => ({}),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}))

jest.mock('@/src/shared/lib/submissionCache', () => ({
  createSubmissionCache: jest.fn().mockResolvedValue({}),
  getCurrentCacheId: jest.fn().mockResolvedValue('cache-1'),
}))

jest.mock('@/src/features/draft-submission/hooks/useSubmissionSubmit', () => ({
  useSubmissionSubmit: () => ({
    handleDone: jest.fn(),
    handleReset: jest.fn(),
  }),
}))

jest.mock('@/src/core/location/liveFix', () => ({
  useLocationCapture: () => ({
    status: 'idle',
    startedAt: null,
    result: undefined,
  }),
}))

describe('Submission Details manual time', () => {
  it('reads "Time unknown" until the user picks a time', async () => {
    useSubmissionStore.setState({
      cats: [observedCat()],
      submission: { location_type: 'pin', time_type: 'manual' },
    })

    await render(<CreateSubmissionScreen />)

    expect(screen.getByText(submissionCopy.time.unknown)).toBeTruthy()
  })
})
