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
 *   1. A chosen mode not written to storage, and therefore lost on the next
 *      cold start. This is the bug that was already live: the previous config
 *      read a key that nothing in the repo ever wrote.
 *   2. 'system' resolving to the wrong Unistyles theme name — it must read
 *      the OS scheme, not just fall back to a fixed default, or the initial
 *      paint is wrong whenever the OS is actually in light mode.
 *   3. Startup ignoring the persisted mode.
 *   4. A breakpoint set that does not start at 0, which silently leaves the
 *      narrowest screens with no matching value.
 *
 * #338 found Unistyles' own adaptiveThemes does not track a live OS change on
 * a device — this module no longer uses it at all (see resolveSystemTheme),
 * so there is nothing here about adaptiveThemes/hasAdaptiveThemes any more.
 * The live-tracking half now lives in AppProviders' SystemThemeSync, which
 * this file does not cover.
 */

import type * as Unistyles from 'react-native-unistyles'

const mockStore = new Map<string, string>()

// Narrow storage fake, by the testing policy's MMKV exception: each reload
// below (jest.resetModules) builds a fresh in-memory MMKV, so the supplied
// test implementation cannot carry a stored mode across a cold start.
jest.mock('@/src/shared/utils/mmkv', () => ({
  mmkvInstance: {
    getString: (key: string) => mockStore.get(key),
    set: (key: string, value: string) => {
      mockStore.set(key, value)
    },
  },
}))

let mockColorScheme: 'light' | 'dark' | null = 'dark'
jest.mock('@/src/shared/utils/appearance', () => ({
  getSystemColorScheme: () => mockColorScheme,
}))

type ConfigModule = typeof import('@/src/shared/config/unistyles')

let configure: jest.SpiedFunction<typeof Unistyles.StyleSheet.configure>
let setTheme: jest.SpiedFunction<typeof Unistyles.UnistylesRuntime.setTheme>

/**
 * Import the config fresh, re-running its startup StyleSheet.configure call.
 * Spies go on the library mock's fresh instance, which the config then uses.
 */
const loadConfig = (): ConfigModule => {
  jest.resetModules()
  const { StyleSheet, UnistylesRuntime } = jest.requireMock<typeof Unistyles>(
    'react-native-unistyles',
  )
  configure = jest.spyOn(StyleSheet, 'configure')
  setTheme = jest.spyOn(UnistylesRuntime, 'setTheme')
  return jest.requireActual('@/src/shared/config/unistyles') as ConfigModule
}

const lastConfigureCall = () => configure.mock.lastCall![0]

beforeEach(() => {
  mockStore.clear()
  mockColorScheme = 'dark'
})

describe('setThemeMode', () => {
  it('persists and applies every mode across a full selection journey', () => {
    const { setThemeMode, getThemeMode } = loadConfig()

    for (const mode of ['dark', 'light', 'system', 'dark'] as const) {
      setThemeMode(mode)

      expect(getThemeMode()).toBe(mode)
      if (mode !== 'system') {
        expect(setTheme).toHaveBeenLastCalledWith(mode)
      }
    }
  })

  it('resolves system mode to the OS color scheme, not a fixed default', () => {
    const { setThemeMode } = loadConfig()
    mockColorScheme = 'light'

    setThemeMode('system')

    expect(setTheme).toHaveBeenLastCalledWith('light')
  })

  it('survives a cold start on the mode that was chosen', () => {
    loadConfig().setThemeMode('light')

    // Nothing else changes — only the process restarts.
    const restarted = loadConfig()

    expect(restarted.getThemeMode()).toBe('light')
    expect(lastConfigureCall().settings).toEqual({ initialTheme: 'light' })
  })
})

describe('resolveThemeForAppearanceChange', () => {
  it('ignores an OS change while an explicit theme is pinned', () => {
    const { resolveThemeForAppearanceChange } = loadConfig()

    expect(resolveThemeForAppearanceChange('light', 'dark')).toBeNull()
    expect(resolveThemeForAppearanceChange('dark', 'light')).toBeNull()
  })

  it('follows the OS scheme while System is selected', () => {
    const { resolveThemeForAppearanceChange } = loadConfig()

    expect(resolveThemeForAppearanceChange('light', 'system')).toBe('light')
    expect(resolveThemeForAppearanceChange('dark', 'system')).toBe('dark')
  })

  it('falls back to dark for an unreported OS scheme while System is selected', () => {
    const { resolveThemeForAppearanceChange } = loadConfig()

    expect(resolveThemeForAppearanceChange(null, 'system')).toBe('dark')
    expect(resolveThemeForAppearanceChange(undefined, 'system')).toBe('dark')
  })
})

describe('startup configuration', () => {
  it('defaults to System when nobody has chosen', () => {
    const { getThemeMode } = loadConfig()

    expect(getThemeMode()).toBe('system')
  })

  it('resolves System at startup to the OS color scheme', () => {
    mockColorScheme = 'light'

    loadConfig()

    expect(lastConfigureCall().settings).toEqual({ initialTheme: 'light' })
  })

  it('ignores a stored value that is not a theme mode', () => {
    mockStore.set('themeMode', 'chartreuse')

    expect(loadConfig().getThemeMode()).toBe('system')
  })

  it.each(['light', 'dark'] as const)(
    'pins the theme at startup when the stored mode is %s',
    (mode) => {
      mockStore.set('themeMode', mode)
      mockColorScheme = mode === 'dark' ? 'light' : 'dark'

      loadConfig()

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
