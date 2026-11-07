/**
 * utils/mmkv.ts
 * The app's one synchronous key-value store. Lives below `lib/` and
 * `config/` because the theme mode (config/unistyles.ts) must read it
 * synchronously before the first render.
 */
import { createMMKV } from 'react-native-mmkv'

export const mmkvInstance = createMMKV({ id: 'feralspotter' })
