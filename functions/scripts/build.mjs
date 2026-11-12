import { rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
await rm(new URL('../lib/', import.meta.url), { recursive: true, force: true })
const result = spawnSync(
  process.execPath,
  [require.resolve('typescript/bin/tsc')],
  {
    cwd: new URL('../', import.meta.url),
    stdio: 'inherit',
  },
)
if (result.error) throw result.error
process.exitCode = result.status ?? 1
