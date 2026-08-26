/**
 * Theme mode: persistence, application, and what startup does with it.
 *
 * Shape note — the testing policy prefers a state-machine model for a stateful
 * flow and a plain case for a pure decision on inputs. setThemeMode is the
 * latter: one input, no internal states, no transitions of its own. So this is
 * an explicit journey plus the startup cases rather than an xstate model.
 *
 * Each assertion here exists for a failure that is likely in this specific
 * code, not to demonstrate the code was tested:
 *
 *   1. setTheme called while adaptive themes are still on. Unistyles throws.
 *      The fake runtime below reproduces that rule, so getting the order wrong
 *      fails here instead of crashing the first time someone picks a theme.
 *   2. A chosen mode not written to storage, and therefore lost on the next
 *      cold start. This is the bug that was already live: the previous config
 *      read a key that nothing in the repo ever wrote.
 *   3. Returning to System not re-enabling adaptive themes, leaving the app
 *      pinned to whichever theme was chosen last.
 *   4. Startup ignoring the persisted mode, or handing Unistyles both
 *      adaptiveThemes and initialTheme, which are mutually exclusive.
 *   5. A breakpoint set that does not start at 0, which silently leaves the
 *      narrowest screens with no matching value.
 */

const mockStore = new Map<string, string>()

const mockRuntime = {
  hasAdaptiveThemes: false,
  themeName: 'dark' as 'dark' | 'light',
  setAdaptiveThemes(enabled: boolean) {
    this.hasAdaptiveThemes = enabled
  },
  setTheme(name: 'dark' | 'light') {
    // The real Unistyles runtime rejects this outright. Reproduced so that a
    // wrong call order is a test failure rather than a device-only crash.
    if (this.hasAdaptiveThemes) {
      throw new Error(
        'setTheme is not allowed while adaptive themes are enabled',
      )
    }
    this.themeName = name
  },
}

const mockConfigure = jest.fn()

jest.mock('react-native-unistyles', () => ({
  StyleSheet: { configure: mockConfigure },
  UnistylesRuntime: mockRuntime,
}))

jest.mock('@/src/lib/cache/storage', () => ({
  mmkvInstance: {
    getString: (key: string) => mockStore.get(key),
    set: (key: string, value: string) => {
      mockStore.set(key, value)
    },
  },
}))

type ConfigModule = typeof import('../unistyles')

/** Import the config fresh, re-running its startup StyleSheet.configure call. */
const loadConfig = (): ConfigModule => {
  jest.resetModules()
  return require('../unistyles') as ConfigModule
}

const lastConfigureCall = () =>
  mockConfigure.mock.calls[mockConfigure.mock.calls.length - 1][0]

beforeEach(() => {
  mockStore.clear()
  mockConfigure.mockClear()
  // Start from the default the app ships with, so the first manual selection
  // in a journey has to disable adaptive themes to succeed.
  mockRuntime.hasAdaptiveThemes = true
  mockRuntime.themeName = 'dark'
})

describe('setThemeMode', () => {
  it('persists and applies every mode across a full selection journey', () => {
    const { setThemeMode, getThemeMode } = loadConfig()

    // A real sequence: leave System, switch between the pinned themes, return
    // to System, then leave it again. Returning is the step that regressed in
    // the original implementation.
    for (const mode of ['dark', 'light', 'system', 'dark'] as const) {
      setThemeMode(mode)

      expect(getThemeMode()).toBe(mode)
      expect(mockRuntime.hasAdaptiveThemes).toBe(mode === 'system')
      if (mode !== 'system') {
        expect(mockRuntime.themeName).toBe(mode)
      }
    }
  })

  it('survives a cold start on the mode that was chosen', () => {
    loadConfig().setThemeMode('light')

    // Nothing else changes — only the process restarts.
    const restarted = loadConfig()

    expect(restarted.getThemeMode()).toBe('light')
    expect(lastConfigureCall().settings).toEqual({ initialTheme: 'light' })
  })
})

describe('startup configuration', () => {
  it('defaults to System when nobody has chosen', () => {
    const { getThemeMode } = loadConfig()

    expect(getThemeMode()).toBe('system')
    expect(lastConfigureCall().settings).toEqual({ adaptiveThemes: true })
  })

  it('ignores a stored value that is not a theme mode', () => {
    mockStore.set('themeMode', 'chartreuse')

    expect(loadConfig().getThemeMode()).toBe('system')
  })

  it.each(['light', 'dark'] as const)(
    'pins the theme at startup when the stored mode is %s',
    (mode) => {
      mockStore.set('themeMode', mode)

      loadConfig()

      // Passing both settings is a Unistyles error, so this asserts the exact
      // object rather than just the presence of initialTheme.
      expect(lastConfigureCall().settings).toEqual({ initialTheme: mode })
    },
  )

  it('registers breakpoints starting at 0 so styles cascade from the narrowest screen', () => {
    loadConfig()

    const { breakpoints } = lastConfigureCall()
    expect(
      Math.min(...Object.values(breakpoints as Record<string, number>)),
    ).toBe(0)
    expect(Object.values(breakpoints as Record<string, number>)).toContain(0)
  })
})
