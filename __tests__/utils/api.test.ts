import { retryApiCall } from '@/src/utils/api'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

describe('retryApiCall', () => {
  it('resolves with the result on first success without retrying', async () => {
    const apiCall = jest.fn().mockResolvedValue('ok')

    await expect(retryApiCall(apiCall, 3, 1)).resolves.toBe('ok')
    expect(apiCall).toHaveBeenCalledTimes(1)
  })

  it('retries after a failure and resolves once a later attempt succeeds', async () => {
    const apiCall = jest
      .fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce('ok')

    await expect(retryApiCall(apiCall, 3, 1)).resolves.toBe('ok')
    expect(apiCall).toHaveBeenCalledTimes(2)
  })

  it('throws the last error once every retry is exhausted', async () => {
    const failure = new Error('persistent failure')
    const apiCall = jest.fn().mockRejectedValue(failure)

    await expect(retryApiCall(apiCall, 2, 1)).rejects.toBe(failure)
    expect(apiCall).toHaveBeenCalledTimes(2)
  })

  it('throws a descriptive error instead of running when maxRetries is 0', async () => {
    const apiCall = jest.fn()

    await expect(retryApiCall(apiCall, 0, 1)).rejects.toThrow(
      'retryApiCall: apiCall did not run (maxRetries <= 0)',
    )
    expect(apiCall).not.toHaveBeenCalled()
  })
})
