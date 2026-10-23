/* global jest, beforeEach */

// Use the library's mock so real styles resolve against real app tokens.
require('react-native-unistyles/mocks')

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

const { StyleSheet, UnistylesRuntime } = require('react-native-unistyles')
const { darkTheme, lightTheme } = require('./src/config/themes')

// Nonzero insets make missing safe-area padding observable in layout tests.
Object.assign(UnistylesRuntime.miniRuntime, {
  insets: { top: 24, bottom: 24, left: 0, right: 0, ime: 0 },
  screen: { width: 390, height: 844 },
})
StyleSheet.configure({ themes: { dark: darkTheme, light: lightTheme } })

// MMKV 4 selects its own in-memory implementation when NODE_ENV is 'test'.
// Keep storage isolated without replacing the application's storage adapter.
const AsyncStorage = require('@react-native-async-storage/async-storage')
const { mmkvInstance } = jest.requireActual('./src/lib/cache/storage')
beforeEach(async () => {
  await AsyncStorage.clear()
  mmkvInstance.clearAll()
})
