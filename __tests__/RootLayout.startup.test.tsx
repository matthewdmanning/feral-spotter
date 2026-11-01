import { act, render, screen, waitFor } from '@testing-library/react-native'
import { discardUnsurvivingDraft } from '@/src/lib/submission/draft'
import {
  initializeDraft,
  useDraftStartupStore,
} from '@/src/hooks/useDraftStartupStore'
import * as SplashScreen from 'expo-splash-screen'
import RootLayout from '@/src/app/_layout'
import SubmissionLayout from '@/src/app/submission/_layout'

jest.mock('@/src/shared/config/unistyles', () => ({}))
jest.mock('@react-native-community/netinfo', () =>
  jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock'),
)
jest.mock('@/src/lib/submission/draft', () => ({
  discardUnsurvivingDraft: jest.fn(),
}))
jest.mock('@/src/providers/AppProviders', () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@expo-google-fonts/nunito/useFonts', () => ({
  useFonts: () => [true, null],
}))
jest.mock('expo-router', () => ({
  Stack: Object.assign(
    () => {
      const { Text } = jest.requireActual('react-native')
      return <Text>Routes mounted</Text>
    },
    { Screen: () => null },
  ),
}))
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}))

describe('RootLayout draft start-up ordering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useDraftStartupStore.setState(useDraftStartupStore.getInitialState(), true)
  })

  it('holds submission routes during cleanup while leaving the camera route available', () => {
    useDraftStartupStore.setState({ phase: 'cleaning' })
    render(<SubmissionLayout />)
    expect(screen.queryByText('Routes mounted')).toBeNull()
    expect(screen.getByText('Preparing your sighting')).toBeOnTheScreen()
    act(() => useDraftStartupStore.setState({ phase: 'ready' }))
    expect(screen.getByText('Routes mounted')).toBeOnTheScreen()
  })

  it('mounts routes and releases the splash while restoration and cleanup are pending', async () => {
    let finishCleanup!: () => void
    let enableCapture!: () => void
    jest
      .mocked(discardUnsurvivingDraft)
      .mockImplementationOnce((_now, onCaptureReady) => {
        enableCapture = () => onCaptureReady?.()
        return new Promise<void>((resolve) => {
          finishCleanup = resolve
        })
      })

    render(<RootLayout />)
    expect(screen.getByText('Routes mounted')).toBeOnTheScreen()
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(discardUnsurvivingDraft).toHaveBeenCalledTimes(1),
    )
    expect(useDraftStartupStore.getState().phase).toBe('restoring')

    const sharedTask = initializeDraft()
    expect(initializeDraft()).toBe(sharedTask)
    act(() => enableCapture())
    expect(useDraftStartupStore.getState().phase).toBe('cleaning')

    await act(async () => finishCleanup())
    await sharedTask
    expect(useDraftStartupStore.getState().phase).toBe('ready')
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1)
  })

  it('reports a cleanup failure and still releases the splash', async () => {
    const error = new Error('Storage unavailable')
    const log = jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.mocked(discardUnsurvivingDraft).mockRejectedValueOnce(error)
    try {
      render(<RootLayout />)
      await waitFor(() =>
        expect(screen.getByText('Routes mounted')).toBeOnTheScreen(),
      )
      expect(log).toHaveBeenCalledWith(
        'Could not restore the draft at start-up',
        error,
      )
      expect(useDraftStartupStore.getState().phase).toBe('error')
      expect(screen.getByText('Routes mounted')).toBeOnTheScreen()
      expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1)
    } finally {
      log.mockRestore()
    }
  })
})
