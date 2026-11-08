import { useAuthAttempt } from '@/src/hooks/useAuthAttempt'
import { useUIStore } from '@/src/hooks/useUIStore'
import { act, renderHook } from '@testing-library/react-native'
import { router } from 'expo-router'

/**
 * One attempt at a time: a second tap while the first runs does nothing.
 * A dismissed provider sheet is silent; any other failure alerts.
 */
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }))
jest.mock('@/src/hooks/consentFlow', () => ({
  nextConsentRoute: () => '/consent',
}))

const copy = { tag: '[test]', title: 'Failed', message: 'Try again.' }

beforeEach(() => {
  jest.clearAllMocks()
  useUIStore.setState(useUIStore.getInitialState())
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

it('ignores a second attempt while one runs, then advances once', async () => {
  const { result } = await renderHook(() => useAuthAttempt())
  let finish!: () => void
  const run = jest.fn(() => new Promise<void>((r) => (finish = r)))
  let first!: Promise<void>
  await act(() => {
    first = result.current.attempt(run, copy)
    void result.current.attempt(run, copy)
  })
  expect(run).toHaveBeenCalledTimes(1)
  expect(result.current.busy).toBe(true)
  await act(async () => {
    finish()
    await first
  })
  expect(router.replace).toHaveBeenCalledTimes(1)
  expect(result.current.busy).toBe(false)
})

it('stays silent on cancellation and alerts on other failures', async () => {
  const { result } = await renderHook(() => useAuthAttempt())
  await act(() =>
    result.current.attempt(
      () => Promise.reject(new Error('SIGN_IN_CANCELLED')),
      copy,
    ),
  )
  expect(useUIStore.getState().dialog).toBeNull()
  await act(() =>
    result.current.attempt(() => Promise.reject(new Error('x')), copy),
  )
  expect(useUIStore.getState().dialog?.title).toBe('Failed')
  expect(router.replace).not.toHaveBeenCalled()
})
